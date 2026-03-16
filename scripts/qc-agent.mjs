#!/usr/bin/env node
/**
 * QC Agent — Automated Quality Control for boredbrain.app
 *
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Usage:
 *   node scripts/qc-agent.mjs
 *   node scripts/qc-agent.mjs --base-url=http://localhost:3000   # test local
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL =
  process.argv.find((a) => a.startsWith("--base-url="))?.split("=")[1] ??
  "https://boredbrain.app";

const SCREENSHOT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "qc-screenshots"
);

const TIMEOUT_PAGE = 20_000; // 20s per page
const TIMEOUT_API = 10_000; // 10s per API call

// Pages to test
const PAGES = [
  { path: "/", name: "Homepage" },
  { path: "/arena", name: "Arena" },
  { path: "/marketplace", name: "Marketplace" },
  { path: "/agents", name: "Agents" },
  { path: "/agents/registry", name: "Agent Registry" },
  { path: "/agents/register", name: "Agent Register" },
  { path: "/stats", name: "Stats" },
  { path: "/topics", name: "Topics" },
  { path: "/playground", name: "Playground" },
  { path: "/economy", name: "Economy" },
];

// API endpoints to test
const APIS = [
  {
    path: "/api/agents/discover?limit=3",
    name: "Agents Discover",
    validate: (json) => {
      const agents = json?.agents ?? json?.data?.agents ?? json?.data;
      return Array.isArray(agents) && agents.length > 0
        ? null
        : "No agents array or empty";
    },
  },
  {
    path: "/api/topics?type=debates&limit=3",
    name: "Topics/Debates",
    validate: (json) => {
      const debates =
        json?.debates ?? json?.topics ?? json?.data?.debates ?? json?.data;
      return Array.isArray(debates) && debates.length > 0
        ? null
        : "No debates array or empty";
    },
  },
  {
    path: "/api/economy/stats",
    name: "Economy Stats",
    validate: (json) => {
      const data = json?.data ?? json;
      return data && typeof data === "object" && Object.keys(data).length > 0
        ? null
        : "No data returned";
    },
  },
  {
    path: "/api/marketplace?limit=3",
    name: "Marketplace",
    validate: (json) => {
      const items =
        json?.agents ?? json?.listings ?? json?.data?.agents ?? json?.data;
      return Array.isArray(items) && items.length > 0
        ? null
        : "No agents/listings returned";
    },
  },
];

// Error strings that indicate a page crash
const ERROR_PATTERNS = [
  "Application error",
  "Internal Server Error",
  "500",
  "This page could not be found",
  "Unhandled Runtime Error",
  "Something went wrong",
];

// ---------------------------------------------------------------------------
// Results tracking
// ---------------------------------------------------------------------------

const results = { pages: [], apis: [], data: [], failures: [] };

function pass(category, name) {
  results[category].push({ name, passed: true });
}

function fail(category, name, reason) {
  results[category].push({ name, passed: false, reason });
  results.failures.push(`${name}: ${reason}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slug(pagePath) {
  return pagePath === "/" ? "homepage" : pagePath.replace(/\//g, "-").replace(/^-/, "");
}

async function takeScreenshot(page, pagePath) {
  const filename = `${slug(pagePath)}.png`;
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testPageLoad(page, entry) {
  const url = `${BASE_URL}${entry.path}`;
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_PAGE,
    });

    // Wait a bit for client-side hydration
    await page.waitForTimeout(2000);

    const status = response?.status() ?? 0;

    // Screenshot regardless of pass/fail
    await takeScreenshot(page, entry.path).catch(() => {});

    if (status >= 400) {
      fail("pages", `${entry.name} (${entry.path})`, `HTTP ${status}`);
      return;
    }

    // Check for visible error text
    const bodyText = await page.textContent("body").catch(() => "");
    const errorFound = ERROR_PATTERNS.find(
      (pat) => bodyText && bodyText.includes(pat)
    );
    // Only flag "500" if it looks like an error page (very short body)
    if (errorFound) {
      if (errorFound === "500" && bodyText.length > 500) {
        // Likely just a number on the page, not an error
        pass("pages", `${entry.name} (${entry.path})`);
      } else {
        fail(
          "pages",
          `${entry.name} (${entry.path})`,
          `Error text visible: "${errorFound}"`
        );
      }
      return;
    }

    pass("pages", `${entry.name} (${entry.path})`);
  } catch (err) {
    await takeScreenshot(page, entry.path).catch(() => {});
    fail("pages", `${entry.name} (${entry.path})`, err.message.slice(0, 120));
  }
}

async function testAPI(entry) {
  const url = `${BASE_URL}${entry.path}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_API);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      fail("apis", entry.name, `HTTP ${res.status}`);
      return;
    }

    const json = await res.json();
    const problem = entry.validate(json);
    if (problem) {
      fail("apis", entry.name, problem);
    } else {
      pass("apis", entry.name);
    }
  } catch (err) {
    fail("apis", entry.name, err.message.slice(0, 120));
  }
}

async function testDataConsistency(page) {
  // 1. Arena should show debate content if API has debates
  try {
    await page.goto(`${BASE_URL}/arena`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_PAGE,
    });
    await page.waitForTimeout(3000);
    const arenaText = await page.textContent("body").catch(() => "");

    const hasNoDebates =
      arenaText.includes("No Active Debates") ||
      arenaText.includes("No debates") ||
      arenaText.includes("No active");

    // Check API side
    const apiRes = await fetch(
      `${BASE_URL}/api/topics?type=debates&limit=3`
    ).catch(() => null);
    const apiJson = await apiRes?.json().catch(() => null);
    const apiHasDebates =
      Array.isArray(apiJson?.debates ?? apiJson?.topics ?? apiJson?.data) &&
      (apiJson?.debates ?? apiJson?.topics ?? apiJson?.data)?.length > 0;

    if (apiHasDebates && hasNoDebates) {
      fail(
        "data",
        "Arena shows debates",
        "API has debates but page shows empty state"
      );
    } else {
      pass("data", "Arena shows debates");
    }
  } catch (err) {
    fail("data", "Arena shows debates", err.message.slice(0, 120));
  }

  // 2. Marketplace should show agent cards
  try {
    await page.goto(`${BASE_URL}/marketplace`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_PAGE,
    });
    await page.waitForTimeout(3000);
    const mpText = await page.textContent("body").catch(() => "");

    const isEmpty =
      mpText.includes("No agents found") ||
      mpText.includes("No listings") ||
      mpText.includes("Nothing here");

    if (isEmpty) {
      fail("data", "Marketplace has agents", "Page shows empty state");
    } else {
      pass("data", "Marketplace has agents");
    }
  } catch (err) {
    fail("data", "Marketplace has agents", err.message.slice(0, 120));
  }

  // 3. Stats page should show real numbers (not all zeros)
  try {
    await page.goto(`${BASE_URL}/stats`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_PAGE,
    });
    await page.waitForTimeout(3000);

    // Look for stat numbers - grab all text that looks like a count
    const numbers = await page.$$eval(
      "h2, h3, [class*='stat'], [class*='count'], [class*='number'], span, p",
      (els) =>
        els
          .map((el) => el.textContent?.trim())
          .filter((t) => t && /^\d[\d,\.]*$/.test(t))
    );

    const allZeros =
      numbers.length > 0 && numbers.every((n) => parseFloat(n) === 0);

    if (allZeros) {
      fail("data", "Stats shows real numbers", "All visible numbers are 0");
    } else {
      pass("data", "Stats shows real numbers");
    }
  } catch (err) {
    fail("data", "Stats shows real numbers", err.message.slice(0, 120));
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport() {
  const count = (cat) => {
    const total = results[cat].length;
    const passed = results[cat].filter((r) => r.passed).length;
    return `${passed}/${total}`;
  };

  const line = "\u2550".repeat(50);

  console.log(`\n${line}`);
  console.log(`  QC REPORT \u2014 ${BASE_URL}`);
  console.log(line);
  console.log(`  Pages:       ${count("pages")} passed`);
  console.log(`  APIs:        ${count("apis")} passed`);
  console.log(`  Data:        ${count("data")} consistent`);
  console.log(`  Screenshots: saved to scripts/qc-screenshots/`);

  if (results.failures.length > 0) {
    console.log(`\n  FAILURES:`);
    for (const f of results.failures) {
      console.log(`  \u2718 ${f}`);
    }
  } else {
    console.log(`\n  \u2714 All checks passed!`);
  }

  console.log(`${line}\n`);

  // Exit with code 1 if any failures
  if (results.failures.length > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nQC Agent starting \u2014 target: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Ensure screenshot dir exists
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "BoredBrain-QC-Agent/1.0 (Playwright; automated quality check)",
  });

  try {
    // ---- Page Load Tests ----
    console.log("[1/4] Page Load Tests");
    const page = await context.newPage();
    for (const entry of PAGES) {
      process.stdout.write(`  Testing ${entry.name}...`);
      await testPageLoad(page, entry);
      const last = results.pages[results.pages.length - 1];
      console.log(last.passed ? " \u2714" : ` \u2718 (${last.reason})`);
    }

    // ---- API Health Tests ----
    console.log("\n[2/4] API Health Tests");
    for (const entry of APIS) {
      process.stdout.write(`  Testing ${entry.name}...`);
      await testAPI(entry);
      const last = results.apis[results.apis.length - 1];
      console.log(last.passed ? " \u2714" : ` \u2718 (${last.reason})`);
    }

    // ---- Data Consistency Tests ----
    console.log("\n[3/4] Data Consistency Tests");
    await testDataConsistency(page);
    for (const r of results.data) {
      console.log(`  ${r.name}... ${r.passed ? "\u2714" : `\u2718 (${r.reason})`}`);
    }

    // ---- Visual Regression (screenshots already taken) ----
    console.log("\n[4/4] Visual Regression");
    console.log(`  Screenshots saved to ${SCREENSHOT_DIR}`);

    await page.close();
  } finally {
    await context.close();
    await browser.close();
  }

  // ---- Summary ----
  printReport();
}

main().catch((err) => {
  console.error("QC Agent crashed:", err);
  process.exit(2);
});

import { chromium } from 'playwright';
import { resolve } from 'path';

const SCREENSHOTS_DIR = resolve(import.meta.dirname, 'screenshots');
const BASE_URL = 'https://boredbrain.app';
const VIEWPORT = { width: 1920, height: 1080 };

const PAGES = [
  { name: '01-homepage', url: '/', wait: 3000 },
  { name: '02-homepage-scroll', url: '/', scroll: 800, wait: 2000 },
  { name: '03-arena', url: '/arena', wait: 4000 },
  { name: '04-arena-scroll', url: '/arena', scroll: 600, wait: 2000 },
  { name: '05-marketplace', url: '/marketplace', wait: 3000 },
  { name: '06-marketplace-scroll', url: '/marketplace', scroll: 500, wait: 2000 },
  { name: '07-playground', url: '/playground', wait: 3000 },
  { name: '08-stats', url: '/stats', wait: 3000 },
  { name: '09-topics', url: '/topics', wait: 3000 },
  { name: '10-registry', url: '/agents/registry', wait: 3000 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });

  for (const page of PAGES) {
    console.log(`Capturing ${page.name}...`);
    const p = await context.newPage();

    try {
      await p.goto(`${BASE_URL}${page.url}`, { waitUntil: 'networkidle', timeout: 15000 });
    } catch {
      console.log(`  Warning: networkidle timeout, continuing...`);
    }

    if (page.wait) await p.waitForTimeout(page.wait);
    if (page.scroll) await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), page.scroll);
    if (page.scroll) await p.waitForTimeout(500);

    await p.screenshot({ path: `${SCREENSHOTS_DIR}/${page.name}.png`, type: 'png' });
    console.log(`  ✓ ${page.name}.png`);
    await p.close();
  }

  await browser.close();
  console.log(`\nDone! ${PAGES.length} screenshots saved to ${SCREENSHOTS_DIR}`);
}

main().catch(console.error);

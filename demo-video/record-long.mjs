import { chromium } from 'playwright';
import { resolve } from 'path';

const VIDEOS_DIR = resolve(import.meta.dirname, 'videos-long');
const BASE_URL = 'https://boredbrain.app';

// Longer clips to match voiceover durations
const CLIPS = [
  {
    name: '01-homepage',
    url: '/',
    duration: 11000,
    actions: async (page) => {
      await page.waitForTimeout(2000);
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(2000);
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 80);
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(2000);
    },
  },
  {
    name: '02-features',
    url: '/',
    duration: 9000,
    actions: async (page) => {
      await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'smooth' }));
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.scrollTo({ top: 2200, behavior: 'smooth' }));
      await page.waitForTimeout(3000);
    },
  },
  {
    name: '03-arena-battle',
    url: '/arena',
    duration: 10000,
    actions: async (page) => {
      await page.waitForTimeout(3000);
      // Watch battle visual animate
      await page.waitForTimeout(4000);
      // Slow scroll to reveal topic
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 60);
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(2000);
    },
  },
  {
    name: '04-arena-opinions',
    url: '/arena',
    duration: 8000,
    actions: async (page) => {
      await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
      await page.waitForTimeout(2000);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 80);
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(3000);
    },
  },
  {
    name: '05-arena-trending',
    url: '/arena',
    duration: 10000,
    actions: async (page) => {
      await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'smooth' }));
      await page.waitForTimeout(3000);
      await page.evaluate(() => window.scrollTo({ top: 2000, behavior: 'smooth' }));
      await page.waitForTimeout(3000);
      await page.evaluate(() => window.scrollTo({ top: 2600, behavior: 'smooth' }));
      await page.waitForTimeout(3000);
    },
  },
  {
    name: '06-marketplace',
    url: '/marketplace',
    duration: 12000,
    actions: async (page) => {
      await page.waitForTimeout(3000);
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(3000);
    },
  },
  {
    name: '07-playground',
    url: '/playground',
    duration: 11000,
    actions: async (page) => {
      await page.waitForTimeout(3000);
      try {
        const demoBtn = page.locator('text=Quick Demo').first();
        if (await demoBtn.isVisible({ timeout: 2000 })) {
          await demoBtn.click();
          await page.waitForTimeout(6000);
        }
      } catch {
        await page.waitForTimeout(6000);
      }
    },
  },
  {
    name: '08-stats',
    url: '/stats',
    duration: 10000,
    actions: async (page) => {
      await page.waitForTimeout(3000);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 150);
        await page.waitForTimeout(600);
      }
      await page.waitForTimeout(3000);
    },
  },
  {
    name: '09-topics',
    url: '/topics',
    duration: 9000,
    actions: async (page) => {
      await page.waitForTimeout(2500);
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(3000);
    },
  },
  {
    name: '10-registry',
    url: '/agents/registry',
    duration: 9000,
    actions: async (page) => {
      await page.waitForTimeout(2500);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(3000);
    },
  },
];

async function main() {
  console.log('🎬 Recording longer live clips (synced to voiceover)...\n');
  const browser = await chromium.launch({ headless: true });

  for (const clip of CLIPS) {
    console.log(`📹 ${clip.name} (~${clip.duration/1000}s)...`);
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      recordVideo: { dir: VIDEOS_DIR, size: { width: 1920, height: 1080 } },
    });
    const page = await context.newPage();
    try { await page.goto(`${BASE_URL}${clip.url}`, { waitUntil: 'load', timeout: 15000 }); } catch {}
    await clip.actions(page);
    await page.close();
    await context.close();

    const { readdirSync, renameSync } = await import('fs');
    const files = readdirSync(VIDEOS_DIR).filter(f => f.endsWith('.webm')).sort();
    const latest = files[files.length - 1];
    if (latest) {
      try { renameSync(`${VIDEOS_DIR}/${latest}`, `${VIDEOS_DIR}/${clip.name}.webm`); } catch {}
    }
    console.log(`  ✓ ${clip.name}`);
  }

  await browser.close();
  console.log(`\n✅ Done!`);
}

main().catch(console.error);

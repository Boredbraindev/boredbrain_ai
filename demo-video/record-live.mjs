import { chromium } from 'playwright';
import { resolve } from 'path';

const VIDEOS_DIR = resolve(import.meta.dirname, 'videos');
const BASE_URL = 'https://boredbrain.app';

// Each clip: navigate, interact, record ~3-5 seconds of real activity
const CLIPS = [
  {
    name: '01-hero-landing',
    url: '/',
    actions: async (page) => {
      await page.waitForTimeout(1500);
      // Slow scroll down to reveal stats
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 150);
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(1000);
    },
  },
  {
    name: '02-hero-features',
    url: '/',
    actions: async (page) => {
      await page.waitForTimeout(500);
      // Scroll to feature grid
      await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'smooth' }));
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'smooth' }));
      await page.waitForTimeout(2000);
    },
  },
  {
    name: '03-arena-battle',
    url: '/arena',
    actions: async (page) => {
      await page.waitForTimeout(2000);
      // Watch battle visual animate
      await page.waitForTimeout(3000);
    },
  },
  {
    name: '04-arena-scroll',
    url: '/arena',
    actions: async (page) => {
      await page.waitForTimeout(1000);
      // Scroll through opinions
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(1500);
    },
  },
  {
    name: '05-arena-debates',
    url: '/arena',
    actions: async (page) => {
      await page.waitForTimeout(500);
      // Scroll to debates grid
      await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'smooth' }));
      await page.waitForTimeout(2000);
      // Scroll to trending topics with images
      await page.evaluate(() => window.scrollTo({ top: 2000, behavior: 'smooth' }));
      await page.waitForTimeout(2000);
    },
  },
  {
    name: '06-marketplace',
    url: '/marketplace',
    actions: async (page) => {
      await page.waitForTimeout(2000);
      // Scroll through agents
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(1000);
    },
  },
  {
    name: '07-playground',
    url: '/playground',
    actions: async (page) => {
      await page.waitForTimeout(2000);
      // Click Quick Demo if available
      try {
        const demoBtn = page.locator('text=Quick Demo').first();
        if (await demoBtn.isVisible({ timeout: 2000 })) {
          await demoBtn.click();
          await page.waitForTimeout(4000);
        }
      } catch {
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    name: '08-stats-dashboard',
    url: '/stats',
    actions: async (page) => {
      await page.waitForTimeout(2000);
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(1500);
    },
  },
  {
    name: '09-topics',
    url: '/topics',
    actions: async (page) => {
      await page.waitForTimeout(2000);
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 180);
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(1500);
    },
  },
  {
    name: '10-registry',
    url: '/agents/registry',
    actions: async (page) => {
      await page.waitForTimeout(2000);
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 180);
        await page.waitForTimeout(350);
      }
      await page.waitForTimeout(1000);
    },
  },
];

async function main() {
  console.log('🎬 Recording live site clips...\n');

  const browser = await chromium.launch({ headless: true });

  for (const clip of CLIPS) {
    console.log(`📹 Recording ${clip.name}...`);

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1920, height: 1080 },
      },
    });

    const page = await context.newPage();

    try {
      await page.goto(`${BASE_URL}${clip.url}`, { waitUntil: 'load', timeout: 15000 });
    } catch {
      console.log(`  ⚠️ Timeout on load, continuing...`);
    }

    await clip.actions(page);

    await page.close();
    await context.close();

    // Rename the video file
    const { readdirSync, renameSync } = await import('fs');
    const files = readdirSync(VIDEOS_DIR).filter(f => f.endsWith('.webm')).sort();
    const latest = files[files.length - 1];
    if (latest) {
      const newName = `${clip.name}.webm`;
      try {
        renameSync(`${VIDEOS_DIR}/${latest}`, `${VIDEOS_DIR}/${newName}`);
        console.log(`  ✓ ${newName}`);
      } catch {
        console.log(`  ✓ ${latest} (rename skipped)`);
      }
    }
  }

  await browser.close();
  console.log(`\n✅ Done! ${CLIPS.length} clips recorded to ${VIDEOS_DIR}`);
}

main().catch(console.error);

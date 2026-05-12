import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';

export async function capturePageScreenshot(page: Page, siteName: string, pagePath: string, label: string): Promise<string> {
  const screenshotDir = path.resolve(__dirname, '..', 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });

  const filename = `${slugify(siteName)}__${slugify(pagePath || 'home')}__${label}__${Date.now()}.png`;
  const screenshotPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  return screenshotPath;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\/$/, 'home')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'page';
}

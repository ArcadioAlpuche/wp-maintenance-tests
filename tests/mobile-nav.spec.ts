import { expect, test } from '@playwright/test';
import { loadSites, pageUrl } from '../utils/load-sites';
import { createNetworkMonitor } from '../utils/network-monitor';
import { capturePageScreenshot } from '../utils/screenshot-helper';
import { writeResult } from '../utils/report-results';
import { navigateToSitePage } from '../utils/page-navigation';

const DEFAULT_MENU_SELECTORS = [
  'button[aria-label*="menu" i]',
  '.menu-toggle',
  '.navbar-toggle',
  '.hamburger',
  '.mobile-menu-toggle'
];

for (const site of loadSites()) {
  test.describe(`mobile nav: ${site.siteName}`, () => {
    test.skip(site.mobileNav?.enabled === false, 'Mobile navigation checks disabled for this site.');

    for (const path of site.pages) {
      test(`${site.siteName} ${path}`, async ({ page }, testInfo) => {
        const url = pageUrl(site, path);
        const monitor = createNetworkMonitor(page, site.ignoreNetworkPatterns);
        const issues: string[] = [];
        const viewport = site.mobileNav?.viewport ?? { width: 390, height: 844 };
        const menuSelectors = [...(site.mobileNav?.menuSelectors ?? []), ...DEFAULT_MENU_SELECTORS];
        const linkSelector = site.mobileNav?.linkSelector ?? 'nav a, [role="navigation"] a, .menu a, .navbar a, .mobile-menu a';
        let screenshotPath = '';
        let failureScreenshotPath = '';
        let mobileNavResult = {
          viewport,
          menuSelectorFound: '',
          clicked: false,
          visibleLinkCount: 0
        };

        try {
          await page.setViewportSize(viewport);
          const navigation = await navigateToSitePage(page, url);
          const status = navigation.response?.status() ?? 0;

          if (status >= 400 || status === 0) {
            issues.push(`Page failed before mobile nav check. HTTP status: ${status || 'unknown'}.`);
          }

          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

          const menuButton = await firstVisibleLocator(page, menuSelectors);
          if (!menuButton.selector) {
            issues.push(`Mobile menu button was not found. Checked selectors: ${menuSelectors.join(', ')}`);
          } else {
            mobileNavResult.menuSelectorFound = menuButton.selector;
            await menuButton.locator.click();
            mobileNavResult.clicked = true;
            await page.waitForTimeout(500);
          }

          mobileNavResult.visibleLinkCount = await visibleCount(page.locator(linkSelector));
          if (mobileNavResult.clicked && mobileNavResult.visibleLinkCount === 0) {
            issues.push(`No visible navigation links found after opening mobile menu. Checked selector: ${linkSelector}`);
          }

          screenshotPath = await capturePageScreenshot(page, site.siteName, path, 'mobile-nav');

          if (issues.length > 0) {
            failureScreenshotPath = await capturePageScreenshot(page, site.siteName, path, 'mobile-nav-failure');
          }
        } catch (error) {
          issues.push(`Unexpected mobile nav test error: ${(error as Error).message}`);
          failureScreenshotPath = await capturePageScreenshot(page, site.siteName, path, 'mobile-nav-error').catch(() => '');
        } finally {
          await writeResult({
            testType: 'mobile-nav',
            siteName: site.siteName,
            pageUrl: url,
            status: issues.length === 0 ? 'passed' : 'failed',
            consoleErrors: monitor.consoleErrors,
            failedNetworkRequests: monitor.failedRequests,
            wordpressErrors: [],
            brokenShortcodes: [],
            brokenImages: [],
            formDetection: null,
            mobileNavResult,
            screenshotPaths: [screenshotPath, failureScreenshotPath].filter(Boolean),
            notes: issues
          }, testInfo);
        }

        expect(issues).toEqual([]);
      });
    }
  });
}

async function firstVisibleLocator(page: import('@playwright/test').Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      return { selector, locator };
    }
  }

  return { selector: '', locator: page.locator('body') };
}

async function visibleCount(locator: import('@playwright/test').Locator): Promise<number> {
  const count = await locator.count();
  let visible = 0;

  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) {
      visible += 1;
    }
  }

  return visible;
}

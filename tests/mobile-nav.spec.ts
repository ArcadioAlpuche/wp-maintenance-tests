import { expect, test, type Locator, type Page } from '@playwright/test';
import { loadSites, pageUrl, type MobileNavConfig } from '../utils/load-sites';
import { createNetworkMonitor } from '../utils/network-monitor';
import { capturePageScreenshot } from '../utils/screenshot-helper';
import { writeResult } from '../utils/report-results';
import { navigateToSitePage } from '../utils/page-navigation';

const DEFAULT_TOGGLE_SELECTORS = [
  'button[aria-label*="menu" i]',
  'button[aria-label*="navigation" i]',
  '.menu-toggle',
  '.navbar-toggle',
  '.hamburger',
  '.mobile-menu-toggle',
  '.ast-menu-toggle',
  '.elementor-menu-toggle'
];

const DEFAULT_NAV_LINK_SELECTORS = [
  'nav a',
  '.main-navigation a',
  '.menu a',
  '.mobile-menu a',
  '.elementor-nav-menu a'
];

type MobileNavResult = {
  currentUrl: string;
  siteName: string;
  path: string;
  toggleSelectorFound: string | null;
  visibleLinksBeforeClick: number;
  visibleLinksAfterClick: number;
  minVisibleLinks: number;
};

for (const site of loadSites()) {
  test.describe(`mobile nav: ${site.siteName}`, () => {
    if (!site.mobileNav || site.mobileNav.enabled === false) {
      test.skip(`${site.siteName} mobile nav not configured`, async () => {
        // Skipped intentionally when mobileNav is omitted or disabled in sites.config.json.
      });
      return;
    }

    const mobileNav = site.mobileNav;
    const testPaths = mobileNav.testPaths ?? ['/'];

    for (const path of testPaths) {
      test(`${site.siteName} ${path}`, async ({ page }, testInfo) => {
        const url = pageUrl(site, path);
        const monitor = createNetworkMonitor(page, site.ignoreNetworkPatterns);
        const issues: string[] = [];
        const viewport = mobileNav.viewport ?? { width: 390, height: 844 };
        const toggleSelectors = mobileNav.toggleSelectors?.length ? mobileNav.toggleSelectors : DEFAULT_TOGGLE_SELECTORS;
        const navLinkSelectors = mobileNav.navLinkSelectors?.length ? mobileNav.navLinkSelectors : DEFAULT_NAV_LINK_SELECTORS;
        const minVisibleLinks = mobileNav.minVisibleLinks ?? 1;
        let screenshotPath = '';
        let failureScreenshotPath = '';
        let mobileNavResult: MobileNavResult = {
          currentUrl: url,
          siteName: site.siteName,
          path,
          toggleSelectorFound: null,
          visibleLinksBeforeClick: 0,
          visibleLinksAfterClick: 0,
          minVisibleLinks
        };

        try {
          await page.setViewportSize(viewport);
          const navigation = await navigateToSitePage(page, url);
          const responseStatus = navigation.response?.status() ?? null;
          mobileNavResult.currentUrl = page.url();

          if (responseStatus === null) {
            issues.push(`No response received for ${site.siteName} ${path}. Current URL: ${page.url()}`);
          } else if (responseStatus >= 400) {
            issues.push(`Mobile nav page returned HTTP ${responseStatus} for ${site.siteName} ${path}. Current URL: ${page.url()}`);
          }

          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
          mobileNavResult.visibleLinksBeforeClick = await countVisibleLinks(page, navLinkSelectors);

          const toggle = await findFirstVisibleToggle(page, toggleSelectors);
          mobileNavResult.toggleSelectorFound = toggle.selector;

          if (!toggle.locator || !toggle.selector) {
            issues.push(`No visible mobile menu toggle found for ${site.siteName} ${path}. Checked selectors: ${toggleSelectors.join(', ')}`);
          } else {
            try {
              await toggle.locator.click({ timeout: 5_000 });
              await page.waitForTimeout(700);
              mobileNavResult.currentUrl = page.url();
              mobileNavResult.visibleLinksAfterClick = await countVisibleLinks(page, navLinkSelectors);

              if (mobileNavResult.visibleLinksAfterClick < minVisibleLinks) {
                issues.push(
                  `Mobile menu opened with selector "${toggle.selector}", but only ${mobileNavResult.visibleLinksAfterClick} visible navigation link(s) were found. Expected at least ${minVisibleLinks}.`
                );
              }
            } catch (error) {
              issues.push(`Mobile menu toggle "${toggle.selector}" was found, but could not be clicked: ${(error as Error).message}`);
            }
          }

          screenshotPath = await capturePageScreenshot(page, site.siteName, path, 'mobile-nav');

          if (issues.length > 0) {
            failureScreenshotPath = await capturePageScreenshot(page, site.siteName, path, 'mobile-nav-failure');
          }
        } catch (error) {
          issues.push(`Unexpected mobile nav test error for ${site.siteName} ${path}: ${(error as Error).message}`);
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

async function findFirstVisibleToggle(page: Page, selectors: string[]): Promise<{ selector: string | null; locator: Locator | null }> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if (await locator.isVisible().catch(() => false)) {
      return { selector, locator };
    }
  }

  return { selector: null, locator: null };
}

async function countVisibleLinks(page: Page, selectors: string[]): Promise<number> {
  const combinedSelector = selectors.join(', ');
  const links = page.locator(combinedSelector);
  const count = await links.count();
  let visibleLinks = 0;

  for (let index = 0; index < count; index += 1) {
    if (await links.nth(index).isVisible().catch(() => false)) {
      visibleLinks += 1;
    }
  }

  return visibleLinks;
}

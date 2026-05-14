import { expect, test } from '@playwright/test';
import { loadSites, pageUrl } from '../utils/load-sites';
import { createNetworkMonitor, isIgnoredUrl } from '../utils/network-monitor';
import { capturePageScreenshot } from '../utils/screenshot-helper';
import { writeResult } from '../utils/report-results';
import { navigateToSitePage } from '../utils/page-navigation';

type InternalLinkResult = {
  url: string;
  status: number | null;
  ok: boolean;
};

for (const site of loadSites()) {
  test.describe(`internal links: ${site.siteName}`, () => {
    test(`${site.siteName} homepage links`, async ({ page }, testInfo) => {
      const url = pageUrl(site, '/');
      const monitor = createNetworkMonitor(page, site.ignoreNetworkPatterns);
      const issues: string[] = [];
      const maxLinks = site.internalLinkSample?.maxLinks ?? 20;
      const ignorePatterns = [...(site.ignoreNetworkPatterns ?? []), ...(site.internalLinkSample?.ignorePatterns ?? [])];
      let screenshotPath = '';
      let failureScreenshotPath = '';
      let internalLinkResults: InternalLinkResult[] = [];

      try {
        const navigation = await navigateToSitePage(page, url);
        const status = navigation.response?.status() ?? 0;

        if (status >= 400 || status === 0) {
          issues.push(`Homepage failed before internal link sampling. HTTP status: ${status || 'unknown'}.`);
        }

        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
        const links = await collectInternalLinks(page, url, maxLinks, ignorePatterns);

        for (const link of links) {
          const response = await page.goto(link, { waitUntil: 'domcontentloaded' });
          const linkStatus = response?.status() ?? null;
          const ok = linkStatus !== null && linkStatus < 400;

          internalLinkResults.push({ url: link, status: linkStatus, ok });

          if (!ok) {
            issues.push(`Internal link failed: ${linkStatus ?? 'no response'} ${link}`);
          }
        }

        screenshotPath = await capturePageScreenshot(page, site.siteName, '/', 'internal-links');

        if (issues.length > 0) {
          failureScreenshotPath = await capturePageScreenshot(page, site.siteName, '/', 'internal-links-failure');
        }
      } catch (error) {
        issues.push(`Unexpected internal link test error: ${(error as Error).message}`);
        failureScreenshotPath = await capturePageScreenshot(page, site.siteName, '/', 'internal-links-error').catch(() => '');
      } finally {
        await writeResult({
          testType: 'internal-links',
          siteName: site.siteName,
          pageUrl: url,
          status: issues.length === 0 ? 'passed' : 'failed',
          consoleErrors: monitor.consoleErrors,
          failedNetworkRequests: monitor.failedRequests,
          wordpressErrors: [],
          brokenShortcodes: [],
          brokenImages: [],
          formDetection: null,
          internalLinkResults,
          screenshotPaths: [screenshotPath, failureScreenshotPath].filter(Boolean),
          notes: issues
        }, testInfo);
      }

      expect(issues).toEqual([]);
    });
  });
}

async function collectInternalLinks(
  page: import('@playwright/test').Page,
  baseUrl: string,
  maxLinks: number,
  ignorePatterns: string[]
): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  const links = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
  const uniqueLinks = new Set<string>();

  for (const href of links) {
    const parsed = new URL(href);

    if (parsed.origin !== origin || ['mailto:', 'tel:', 'javascript:'].includes(parsed.protocol) || isIgnoredUrl(href, ignorePatterns)) {
      continue;
    }

    parsed.hash = '';
    uniqueLinks.add(parsed.toString());

    if (uniqueLinks.size >= maxLinks) {
      break;
    }
  }

  return Array.from(uniqueLinks);
}

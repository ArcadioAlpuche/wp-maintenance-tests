import { expect, test } from '@playwright/test';
import { loadSites, pageUrl } from '../utils/load-sites';
import { findBrokenShortcodes, findWordPressErrors, looksLikeGeneric404 } from '../utils/wp-error-checks';
import { createNetworkMonitor } from '../utils/network-monitor';
import { capturePageScreenshot } from '../utils/screenshot-helper';
import { writeResult } from '../utils/report-results';
import { navigateToSitePage } from '../utils/page-navigation';

for (const site of loadSites()) {
  test.describe(`smoke: ${site.siteName}`, () => {
    for (const path of site.pages) {
      test(`${site.siteName} ${path}`, async ({ page }, testInfo) => {
        const url = pageUrl(site, path);
        const monitor = createNetworkMonitor(page, site.ignoreNetworkPatterns);
        const issues: string[] = [];
        let status: number | null = null;
        let title = '';
        let bodyText = '';
        let screenshotPath = '';
        let failureScreenshotPath = '';
        let wpErrors: string[] = [];
        let brokenShortcodes: string[] = [];

        try {
          const navigation = await navigateToSitePage(page, url);
          const response = navigation.response;
          status = response?.status() ?? null;

          if (navigation.codespacesWarningSeen && !navigation.codespacesWarningCleared) {
            issues.push('GitHub Codespaces port warning was shown and could not be cleared. The WordPress page was not reached.');
          }

          if (navigation.codespacesAuthMissing) {
            issues.push('Codespaces forwarded-port auth token was not found. Set GITHUB_TOKEN or CODESPACES_BYPASS_TOKEN before running tests against an app.github.dev URL.');
          }

          if (status === null) {
            issues.push('No HTTP response was returned.');
          } else if (status >= 400) {
            issues.push(`HTTP status ${status} is 400 or higher.`);
          }

          const failedDocuments = monitor.failedRequests.filter((request) => request.resourceType === 'document');
          for (const request of failedDocuments) {
            issues.push(`Document request failed: ${request.status ?? request.failureText ?? 'unknown'} ${request.url}`);
          }

          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
          title = (await page.title()).trim();
          bodyText = (await page.locator('body').innerText({ timeout: 10_000 })).trim();
          wpErrors = findWordPressErrors(bodyText);
          brokenShortcodes = findBrokenShortcodes(bodyText, site.ignoreShortcodes);

          if (!title) {
            issues.push('Page title is empty.');
          }

          if (bodyText.length <= 100) {
            issues.push(`Body text is too short (${bodyText.length} characters).`);
          }

          if (wpErrors.length > 0) {
            issues.push(`WordPress/PHP error text found: ${wpErrors.join(', ')}`);
          }

          if (brokenShortcodes.length > 0) {
            issues.push(`Visible broken shortcode(s) found: ${brokenShortcodes.join(', ')}`);
          }

          if (looksLikeGeneric404(title, bodyText, status)) {
            issues.push('Page looks like a generic 404 page.');
          }

          const expectedText = [
            ...(site.expectedText ?? []),
            ...(site.expectedTextByPath?.[path] ?? [])
          ];

          for (const text of expectedText) {
            if (!bodyText.includes(text)) {
              issues.push(`Expected text was not found: "${text}".`);
            }
          }

          screenshotPath = await capturePageScreenshot(page, site.siteName, path, 'smoke');

          if (issues.length > 0) {
            failureScreenshotPath = await capturePageScreenshot(page, site.siteName, path, 'smoke-failure');
          }
        } catch (error) {
          issues.push(`Unexpected smoke test error: ${(error as Error).message}`);
          failureScreenshotPath = await capturePageScreenshot(page, site.siteName, path, 'smoke-error').catch(() => '');
        } finally {
          await writeResult({
            testType: 'smoke',
            siteName: site.siteName,
            pageUrl: url,
            status: issues.length === 0 ? 'passed' : 'failed',
            httpStatus: status,
            consoleErrors: monitor.consoleErrors,
            failedNetworkRequests: monitor.failedRequests,
            wordpressErrors: wpErrors,
            brokenShortcodes,
            brokenImages: [],
            formDetection: null,
            screenshotPaths: [screenshotPath, failureScreenshotPath].filter(Boolean),
            notes: issues
          }, testInfo);
        }

        expect(issues).toEqual([]);
      });
    }
  });
}

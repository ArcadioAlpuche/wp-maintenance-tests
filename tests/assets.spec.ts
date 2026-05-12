import { expect, test } from '@playwright/test';
import { loadSites, pageUrl } from '../utils/load-sites';
import { createNetworkMonitor, isIgnoredUrl } from '../utils/network-monitor';
import { capturePageScreenshot } from '../utils/screenshot-helper';
import { writeResult } from '../utils/report-results';
import { navigateToSitePage } from '../utils/page-navigation';

type BrokenImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  reason: string;
  status?: number;
  failureText?: string;
};

for (const site of loadSites()) {
  test.describe(`assets: ${site.siteName}`, () => {
    for (const path of site.pages) {
      test(`${site.siteName} ${path}`, async ({ page }, testInfo) => {
        const url = pageUrl(site, path);
        const monitor = createNetworkMonitor(page, site.ignoreNetworkPatterns);
        const issues: string[] = [];
        let screenshotPath = '';
        let failureScreenshotPath = '';
        let brokenImages: BrokenImage[] = [];

        try {
          const navigation = await navigateToSitePage(page, url);
          const response = navigation.response;
          const status = response?.status() ?? 0;
          if (navigation.codespacesWarningSeen && !navigation.codespacesWarningCleared) {
            issues.push('GitHub Codespaces port warning was shown and could not be cleared. The WordPress page was not reached.');
          }

          if (navigation.codespacesAuthMissing) {
            issues.push('Codespaces forwarded-port auth token was not found. Set GITHUB_TOKEN or CODESPACES_BYPASS_TOKEN before running tests against an app.github.dev URL.');
          }

          if (status >= 400 || status === 0) {
            issues.push(`Page failed before asset checks. HTTP status: ${status || 'unknown'}.`);
          }

          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
          await scrollPageToLoadLazyAssets(page);
          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

          brokenImages = await page.locator('img').evaluateAll((images) => {
            return images
              .map((image) => {
                const img = image as HTMLImageElement;
                const rect = img.getBoundingClientRect();
                const style = window.getComputedStyle(img);
                const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';

                return {
                  src: img.currentSrc || img.src,
                  alt: img.alt || '',
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  reason: visible ? 'Visible image has no loaded dimensions.' : 'Hidden or offscreen image has no loaded dimensions.',
                  visible
                };
              })
              .filter((image) => image.src && image.visible && (image.width === 0 || image.height === 0))
              .map(({ visible, ...image }) => image);
          });

          const failedImageRequests: BrokenImage[] = monitor.failedRequests
            .filter((request) => request.resourceType === 'image')
            .map((request) => ({
              src: request.url,
              alt: '',
              width: 0,
              height: 0,
              reason: 'Image network request failed.',
              status: request.status,
              failureText: request.failureText
            }));

          const firstPartyBrokenImages = dedupeBrokenImages([...brokenImages, ...failedImageRequests])
            .filter((image) => !isIgnoredUrl(image.src, site.ignoreNetworkPatterns));

          brokenImages = firstPartyBrokenImages;

          if (firstPartyBrokenImages.length > 0) {
            issues.push(`${firstPartyBrokenImages.length} broken image(s) found.`);
          }

          const failedAssets = monitor.failedRequests.filter((request) => request.resourceType === 'stylesheet' || request.resourceType === 'script');
          if (failedAssets.length > 0) {
            issues.push(`${failedAssets.length} failed CSS/JS request(s) found.`);
          }

          screenshotPath = await capturePageScreenshot(page, site.siteName, path, 'assets');

          if (issues.length > 0) {
            failureScreenshotPath = await capturePageScreenshot(page, site.siteName, path, 'assets-failure');
          }
        } catch (error) {
          issues.push(`Unexpected asset test error: ${(error as Error).message}`);
          failureScreenshotPath = await capturePageScreenshot(page, site.siteName, path, 'assets-error').catch(() => '');
        } finally {
          await writeResult({
            testType: 'assets',
            siteName: site.siteName,
            pageUrl: url,
            status: issues.length === 0 ? 'passed' : 'failed',
            consoleErrors: monitor.consoleErrors,
            failedNetworkRequests: monitor.failedRequests,
            wordpressErrors: [],
            brokenImages,
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

async function scrollPageToLoadLazyAssets(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const viewportHeight = window.innerHeight || 800;
    const maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

    for (let y = 0; y <= maxScroll; y += Math.floor(viewportHeight * 0.8)) {
      window.scrollTo(0, y);
      await delay(150);
    }

    window.scrollTo(0, 0);
  });
}

function dedupeBrokenImages(images: BrokenImage[]): BrokenImage[] {
  const imagesBySrc = new Map<string, BrokenImage>();

  for (const image of images) {
    const key = brokenImageKey(image.src);
    const existing = imagesBySrc.get(key);

    if (!existing) {
      imagesBySrc.set(key, image);
      continue;
    }

    imagesBySrc.set(key, {
      ...existing,
      ...image,
      src: existing.src,
      alt: existing.alt || image.alt,
      status: existing.status ?? image.status,
      failureText: existing.failureText ?? image.failureText,
      reason: Array.from(new Set([existing.reason, image.reason])).join(' ')
    });
  }

  return Array.from(imagesBySrc.values());
}

function brokenImageKey(src: string): string {
  try {
    const url = new URL(src);
    const wordpressAssetPath = url.pathname.match(/\/wp-content\/uploads\/.+$/);
    return wordpressAssetPath ? decodeURIComponent(wordpressAssetPath[0]) : src;
  } catch {
    return src;
  }
}

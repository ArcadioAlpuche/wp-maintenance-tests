import { expect, test } from '@playwright/test';
import { loadSites, pageUrl } from '../utils/load-sites';
import { detectForms, detectGenericForm, hasRawFormShortcode } from '../utils/form-detectors';
import { findBrokenShortcodes } from '../utils/wp-error-checks';
import { createNetworkMonitor } from '../utils/network-monitor';
import { capturePageScreenshot } from '../utils/screenshot-helper';
import { writeResult } from '../utils/report-results';
import { navigateToSitePage } from '../utils/page-navigation';

for (const site of loadSites()) {
  test.describe(`forms: ${site.siteName}`, () => {
    for (const formPage of site.formPages ?? []) {
      test(`${site.siteName} ${formPage.path} ${formPage.expectedFormType}`, async ({ page }, testInfo) => {
        const url = pageUrl(site, formPage.path);
        const monitor = createNetworkMonitor(page, site.ignoreNetworkPatterns);
        const issues: string[] = [];
        let screenshotPath = '';
        let failureScreenshotPath = '';
        let detection = null;
        let brokenShortcodes: string[] = [];

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
            issues.push(`Form page failed to load. HTTP status: ${status || 'unknown'}.`);
          }

          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
          detection = await detectForms(page);
          detection.genericForm = await detectGenericForm(
            page,
            formPage.scopeSelector,
            formPage.formSelector,
            formPage.fieldSelector,
            formPage.submitSelector
          );

          const bodyText = await page.locator('body').innerText({ timeout: 10_000 });
          brokenShortcodes = findBrokenShortcodes(bodyText, site.ignoreShortcodes);

          if (await hasRawFormShortcode(page) || brokenShortcodes.length > 0) {
            issues.push(`Visible raw form shortcode found${brokenShortcodes.length ? `: ${brokenShortcodes.join(', ')}` : '.'}`);
          }

          if (formPage.expectedFormType === 'gravity-forms') {
            if (!detection.gravityForms.found) {
              issues.push('Expected Gravity Forms form was not detected.');
            }
            if (!detection.gravityForms.hasSubmitButton) {
              issues.push('Gravity Forms submit button was not found.');
            }
            if (!detection.gravityForms.hasField) {
              issues.push('Gravity Forms input, textarea, or select was not found.');
            }
          }

          if (formPage.expectedFormType === 'ninja-forms') {
            if (!detection.ninjaForms.found) {
              issues.push('Expected Ninja Forms form was not detected.');
            }
            if (!detection.ninjaForms.hasSubmitButton) {
              issues.push('Ninja Forms submit button was not found.');
            }
            if (!detection.ninjaForms.hasField) {
              issues.push('Ninja Forms input, textarea, or select was not found.');
            }
          }

          if (formPage.expectedFormType === 'contact-form-7') {
            if (!detection.contactForm7.found) {
              issues.push('Expected Contact Form 7 form was not detected.');
            }
            if (!detection.contactForm7.hasSubmitButton) {
              issues.push('Contact Form 7 submit button was not found.');
            }
            if (!detection.contactForm7.hasField) {
              issues.push('Contact Form 7 input, textarea, or select was not found.');
            }
          }

          if (formPage.expectedFormType === 'generic-form') {
            if (!detection.genericForm.found) {
              issues.push('Expected generic form was not detected.');
            }
            if (!detection.genericForm.hasSubmitButton) {
              issues.push('Generic form submit button was not found.');
            }
            if (!detection.genericForm.hasField) {
              issues.push('Generic form input, textarea, or select was not found.');
            }
          }

          if (formPage.expectedFormType === 'klaviyo' && formPage.required === true && !detection.klaviyo.found) {
            issues.push('Required Klaviyo form was not detected.');
          }

          if (formPage.submitTest === true) {
            issues.push('submitTest is true, but no safe generic submit flow is implemented yet. Add site-specific behavior before enabling submission.');
          }

          screenshotPath = await capturePageScreenshot(page, site.siteName, formPage.path, 'forms');

          if (issues.length > 0) {
            failureScreenshotPath = await capturePageScreenshot(page, site.siteName, formPage.path, 'forms-failure');
          }
        } catch (error) {
          issues.push(`Unexpected form test error: ${(error as Error).message}`);
          failureScreenshotPath = await capturePageScreenshot(page, site.siteName, formPage.path, 'forms-error').catch(() => '');
        } finally {
          await writeResult({
            testType: 'forms',
            siteName: site.siteName,
            pageUrl: url,
            status: issues.length === 0 ? 'passed' : 'failed',
            consoleErrors: monitor.consoleErrors,
            failedNetworkRequests: monitor.failedRequests,
            wordpressErrors: [],
            brokenShortcodes,
            brokenImages: [],
            formDetection: detection,
            screenshotPaths: [screenshotPath, failureScreenshotPath].filter(Boolean),
            notes: issues
          }, testInfo);
        }

        expect(issues).toEqual([]);
      });
    }
  });
}

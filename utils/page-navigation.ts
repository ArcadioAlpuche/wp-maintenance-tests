import type { Page, Response } from '@playwright/test';

const CODESPACES_WARNING_TEXT = 'You are about to access a development port served by';

export type SiteNavigationResult = {
  response: Response | null;
  finalUrl: string;
  requestedUrl: string;
  codespacesWarningSeen: boolean;
  codespacesWarningCleared: boolean;
  codespacesAuthHeaderUsed: boolean;
  codespacesAuthMissing: boolean;
};

export async function navigateToSitePage(page: Page, url: string): Promise<SiteNavigationResult> {
  const targetUrl = url;
  const codespacesAuthHeaderUsed = await setCodespacesBypassHeader(page, targetUrl);
  let response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  let codespacesWarningSeen = await isCodespacesWarningPage(page);
  let codespacesWarningCleared = !codespacesWarningSeen;

  if (codespacesWarningSeen) {
    const clickedThrough = await clickCodespacesContinue(page);
    response = clickedThrough ?? response;
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    codespacesWarningCleared = !(await isCodespacesWarningPage(page));
  }

  return {
    response,
    finalUrl: page.url(),
    requestedUrl: targetUrl,
    codespacesWarningSeen,
    codespacesWarningCleared,
    codespacesAuthHeaderUsed,
    codespacesAuthMissing: isCodespacesUrl(targetUrl) && codespacesWarningSeen && !codespacesWarningCleared && !codespacesAuthHeaderUsed
  };
}

async function setCodespacesBypassHeader(page: Page, url: string): Promise<boolean> {
  if (!isCodespacesUrl(url)) {
    return false;
  }

  const token = process.env.CODESPACES_BYPASS_TOKEN || process.env.GITHUB_TOKEN;

  if (!token) {
    return false;
  }

  await page.setExtraHTTPHeaders({
    'X-Github-Token': token
  });

  return true;
}

function isCodespacesUrl(url: string): boolean {
  const parsedUrl = new URL(url);
  return parsedUrl.hostname.endsWith('.app.github.dev') || parsedUrl.hostname.endsWith('.githubpreview.dev');
}

async function isCodespacesWarningPage(page: Page): Promise<boolean> {
  return page
    .locator('body')
    .innerText({ timeout: 3_000 })
    .then((text) => text.includes(CODESPACES_WARNING_TEXT))
    .catch(() => false);
}

async function clickCodespacesContinue(page: Page): Promise<Response | null> {
  const continueControl = page.locator(
    [
      'button:has-text("Continue")',
      'a:has-text("Continue")',
      'input[type="submit" i][value*="continue" i]',
      'input[type="button" i][value*="continue" i]',
      'button:has-text("Open")',
      'a:has-text("Open")',
      'button:has-text("Access")',
      'a:has-text("Access")'
    ].join(', ')
  ).first();

  if (!(await continueControl.isVisible().catch(() => false))) {
    return null;
  }

  const previousUrl = page.url();
  const responsePromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => null);
  await continueControl.click();
  const response = await responsePromise;

  if (page.url() === previousUrl) {
    await page.waitForTimeout(1_000);
  }

  return response;
}

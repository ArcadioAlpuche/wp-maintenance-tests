import type { Page } from '@playwright/test';

export type FormDetectionResult = {
  gravityForms: DetectedForm;
  ninjaForms: DetectedForm;
  contactForm7: DetectedForm;
  genericForm: DetectedForm;
  klaviyo: DetectedForm;
};

type DetectedForm = {
  found: boolean;
  hasSubmitButton: boolean;
  hasField: boolean;
  selectorMatches: string[];
};

export async function detectForms(page: Page): Promise<FormDetectionResult> {
  const gravitySelectors = ['.gform_wrapper', 'form[id^="gform_"]', '.gform_body'];
  const ninjaSelectors = ['.nf-form-cont', '.nf-form-layout', 'form[id^="nf-form"]'];
  const contactForm7Selectors = [
    '.wpcf7',
    'form.wpcf7-form',
    '[id^="wpcf7-f"]',
    'input[name="_wpcf7"]'
  ];
  const klaviyoSelectors = [
    '[class*="klaviyo"]',
    '[id*="klaviyo"]',
    'form[action*="klaviyo"]',
    'script[src*="klaviyo"]'
  ];

  return {
    gravityForms: await detectFormGroup(page, gravitySelectors),
    ninjaForms: await detectFormGroup(page, ninjaSelectors),
    contactForm7: await detectFormGroup(page, contactForm7Selectors),
    genericForm: await detectGenericForm(page),
    klaviyo: await detectFormGroup(page, klaviyoSelectors)
  };
}

export async function detectGenericForm(
  page: Page,
  scopeSelector = 'body',
  formSelector = 'form',
  fieldSelector = 'input:not([type="hidden"]), textarea, select',
  submitSelector = 'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Send"), button:has-text("Subscribe"), input[value*="Subscribe" i]'
): Promise<DetectedForm> {
  const scope = page.locator(scopeSelector).first();
  const form = scope.locator(formSelector).first();
  const hasScopedForm = await form.count().then((count) => count > 0).catch(() => false);
  const found = hasScopedForm
    ? await form.isVisible().catch(() => false)
    : await scope.locator(fieldSelector).first().isVisible().catch(() => false);
  const searchRoot = found ? form : scope;

  const hasSubmitButton = await searchRoot
    .locator(submitSelector)
    .first()
    .isVisible()
    .catch(() => false);

  const hasField = await searchRoot
    .locator(fieldSelector)
    .first()
    .isVisible()
    .catch(() => false);

  return {
    found,
    hasSubmitButton,
    hasField,
    selectorMatches: found ? [`${scopeSelector} ${hasScopedForm ? formSelector : fieldSelector}`] : []
  };
}

export async function hasRawFormShortcode(page: Page): Promise<boolean> {
  const bodyText = await page.locator('body').innerText({ timeout: 10_000 });
  return /\[(gravityform|ninja_form|contact-form-7)\b/i.test(bodyText);
}

async function detectFormGroup(page: Page, selectors: string[]): Promise<DetectedForm> {
  const selectorMatches: string[] = [];

  for (const selector of selectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      selectorMatches.push(selector);
    }
  }

  const containerSelector = selectors.join(', ');
  const container = page.locator(containerSelector).first();
  const found = selectorMatches.length > 0;
  const searchRoot = found ? container : page.locator('body');

  const hasSubmitButton = await searchRoot
    .locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Send")')
    .first()
    .isVisible()
    .catch(() => false);

  const hasField = await searchRoot
    .locator('input:not([type="hidden"]), textarea, select')
    .first()
    .isVisible()
    .catch(() => false);

  return {
    found,
    hasSubmitButton,
    hasField,
    selectorMatches
  };
}

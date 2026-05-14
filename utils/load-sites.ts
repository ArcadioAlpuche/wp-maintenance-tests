import fs from 'node:fs';
import path from 'node:path';

export type ExpectedFormType = 'gravity-forms' | 'ninja-forms' | 'contact-form-7' | 'generic-form' | 'klaviyo';

export type FormPageConfig = {
  path: string;
  expectedFormType: ExpectedFormType;
  formSelector?: string;
  scopeSelector?: string;
  fieldSelector?: string;
  submitSelector?: string;
  submitTest?: boolean;
  required?: boolean;
};

export type SiteConfig = {
  siteName: string;
  baseUrl: string;
  pages: string[];
  formPages?: FormPageConfig[];
  mobileNav?: MobileNavConfig;
  ignoreNetworkPatterns?: string[];
  ignoreShortcodes?: string[];
  expectedText?: string[];
  expectedTextByPath?: Record<string, string[]>;
  internalLinkSample?: {
    maxLinks?: number;
    ignorePatterns?: string[];
  };
};

export type MobileNavConfig = {
  enabled?: boolean;
  testPaths?: string[];
  toggleSelectors?: string[];
  navLinkSelectors?: string[];
  minVisibleLinks?: number;
  viewport?: {
    width: number;
    height: number;
  };
};

export function loadSites(): SiteConfig[] {
  const configPath = path.resolve(__dirname, '..', 'sites.config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const sites = JSON.parse(raw) as SiteConfig[];
  const selectedSite = process.env.WP_TEST_SITE || readCliOption('--site');

  if (!Array.isArray(sites)) {
    throw new Error('sites.config.json must contain an array of site configs.');
  }

  const filteredSites = selectedSite
    ? sites.filter((site) => site.siteName.toLowerCase() === selectedSite.toLowerCase())
    : sites;

  if (selectedSite && filteredSites.length === 0) {
    throw new Error(`No site found for --site "${selectedSite}".`);
  }

  return filteredSites.map(normalizeSite);
}

export function pageUrl(site: SiteConfig, pagePath: string): string {
  return new URL(pagePath, site.baseUrl).toString();
}

function normalizeSite(site: SiteConfig): SiteConfig {
  if (!site.siteName || !site.baseUrl || !Array.isArray(site.pages)) {
    throw new Error('Each site must define siteName, baseUrl, and pages.');
  }

  return {
    ...site,
    baseUrl: site.baseUrl.endsWith('/') ? site.baseUrl : `${site.baseUrl}/`,
    pages: site.pages.map((page) => page || '/'),
    formPages: site.formPages ?? [],
    mobileNav: normalizeMobileNav(site.mobileNav),
    ignoreNetworkPatterns: site.ignoreNetworkPatterns ?? [],
    ignoreShortcodes: site.ignoreShortcodes ?? [],
    expectedText: site.expectedText ?? [],
    expectedTextByPath: site.expectedTextByPath ?? {},
    internalLinkSample: {
      maxLinks: site.internalLinkSample?.maxLinks ?? 20,
      ignorePatterns: site.internalLinkSample?.ignorePatterns ?? []
    }
  };
}

function normalizeMobileNav(mobileNav?: MobileNavConfig): MobileNavConfig | undefined {
  if (!mobileNav) {
    return undefined;
  }

  return {
    enabled: mobileNav.enabled ?? true,
    testPaths: mobileNav.testPaths ?? ['/'],
    toggleSelectors: mobileNav.toggleSelectors ?? [],
    navLinkSelectors: mobileNav.navLinkSelectors ?? [],
    minVisibleLinks: mobileNav.minVisibleLinks ?? 1,
    viewport: mobileNav.viewport ?? { width: 390, height: 844 }
  };
}

function readCliOption(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

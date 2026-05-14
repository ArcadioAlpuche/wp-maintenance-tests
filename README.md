# WordPress Maintenance Tests

Playwright + TypeScript smoke tests for catching obvious WordPress breakage after plugin, theme, or composer updates.

The suite is intentionally practical rather than exhaustive. It is meant to help a developer doing maintenance quickly answer: did the updated site still render, did important assets load, did configured forms appear, and did the mobile menu still work?

## Commands

```bash
npm run test
npm run test:smoke
npm run test:assets
npm run test:forms
npm run test:mobile-nav
npm run test:links
npm run test:site -- --site "Example Site"
npm run screenshots:baseline
npm run screenshots:check
```

## Site Config

Sites are configured in `sites.config.json`. Site-specific rules should live there instead of being hardcoded in tests.

```json
[
  {
    "siteName": "Example Site",
    "baseUrl": "https://example.test",
    "pages": [
      "/",
      "/about/",
      "/contact/"
    ],
    "formPages": [],
    "mobileNav": {
      "enabled": true,
      "testPaths": ["/"],
      "toggleSelectors": [
        "button[aria-label*='menu' i]",
        "button[aria-label*='navigation' i]",
        ".menu-toggle",
        ".navbar-toggle",
        ".hamburger",
        ".mobile-menu-toggle",
        ".ast-menu-toggle",
        ".elementor-menu-toggle"
      ],
      "navLinkSelectors": [
        "nav a",
        ".main-navigation a",
        ".menu a",
        ".mobile-menu a",
        ".elementor-nav-menu a"
      ],
      "minVisibleLinks": 1
    },
    "ignoreNetworkPatterns": [
      "googletagmanager.com",
      "google-analytics.com",
      "klaviyo.com",
      "facebook.net"
    ],
    "ignoreShortcodes": [],
    "expectedText": []
  }
]
```

## Mobile Navigation Test

The mobile navigation smoke test checks that a configured site renders a usable mobile menu after maintenance updates.

It verifies:

- The configured page loads with an HTTP status below 400.
- A visible mobile menu toggle can be found.
- The toggle can be clicked.
- Usable navigation links become visible after the click.
- A failure screenshot is captured when the check fails.

Run it with:

```bash
npm run test:mobile-nav
```

If `mobileNav` is missing or `enabled` is `false`, mobile navigation tests are skipped for that site.

## Known Limitations

- The tests are smoke tests, not full end-to-end tests.
- Mobile nav checks are not pixel-perfect responsive layout tests.
- Form checks do not prove emails, CRM integrations, or storage plugins work unless a site-specific submit flow is added.
- Some third-party scripts, chat widgets, weather widgets, analytics tools, and bot blockers may fail in Codespaces/headless browsers. Add stable ignore patterns for expected noise.
- Screenshot comparison is side-by-side only; it does not currently do strict pixel diffing.

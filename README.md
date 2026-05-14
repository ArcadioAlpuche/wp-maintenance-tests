# WordPress Maintenance Tests

Playwright + TypeScript smoke tests for catching obvious WordPress breakage after plugin, theme, or composer updates.

## Mobile Navigation Test

The mobile navigation smoke test checks that a configured site renders a usable mobile menu after maintenance updates.

It verifies:

- The configured page loads with an HTTP status below 400.
- A visible mobile menu toggle can be found.
- The toggle can be clicked.
- Usable navigation links become visible after the click.
- A failure screenshot is captured when the check fails.

It does not do pixel-perfect responsive layout testing. It is intended to catch practical failures such as a missing hamburger button, JavaScript errors preventing the menu from opening, or an opened menu with no visible links.

## Example Config

Add `mobileNav` to a site in `sites.config.json`:

```json
{
  "siteName": "Example Site",
  "baseUrl": "https://example.test",
  "pages": ["/"],
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
  }
}
```

If `mobileNav` is missing or `enabled` is `false`, mobile navigation tests are skipped for that site.

## Run

```bash
npm run test:mobile-nav
```

The regular full suite also includes the mobile nav spec:

```bash
npm run test
```

## Known Limitations

- The test only checks that a menu opens and visible links appear.
- It does not verify visual layout, animations, active states, dropdown hierarchy, or every menu item.
- Some themes use unusual toggle markup, so you may need to add theme-specific selectors in `mobileNav.toggleSelectors`.
- Some menus keep links visible before clicking on certain breakpoints; adjust `viewport` or selectors if needed.

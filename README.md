# WordPress Maintenance Smoke Tests

A lightweight Playwright + TypeScript smoke-testing framework for WordPress maintenance workflows.

This project was built to help catch common site breakage after:

* WordPress plugin updates
* Composer updates
* Theme updates
* Maintenance changes
* Frontend regressions

The primary goal is fast, reliable regression testing for agencies managing multiple WordPress sites.

---

# Features

## Smoke Testing

* Homepage and key page validation
* HTTP status checks
* WordPress fatal error detection
* 404 detection
* Console error logging
* Failed network request detection
* Screenshot capture

## WordPress-Specific Checks

Detects common WordPress maintenance failures, including:

* Raw Gravity Forms shortcodes
* Raw Ninja Forms shortcodes
* PHP fatal errors
* Database connection errors
* Maintenance mode screens
* Broken frontend rendering

## Form Detection

Supports:

* Gravity Forms
* Ninja Forms
* Klaviyo detection

Checks:

* Form containers exist
* Inputs render
* Submit buttons exist
* Broken shortcodes are not visible

## Asset Validation

* Broken images
* Failed CSS requests
* Failed JS requests
* Missing frontend assets

## Mobile Smoke Tests

* Mobile viewport testing
* Mobile navigation checks
* Hamburger/menu toggle validation

## Screenshot Reporting

* Failure screenshots
* Baseline screenshots
* Before/after comparison support

---

# Tech Stack

* Node.js
* TypeScript
* Playwright

---

# Installation

Clone the repository:

```bash
git clone <your-repo-url>
cd wp-maintenance-tests
```

Install dependencies:

```bash
npm install
```

Install Playwright browsers:

```bash
npx playwright install
```

---

# Configuration

Sites are configured in:

```text
sites.config.json
```

Example:

```json
[
  {
    "siteName": "Example Site",
    "pages": [
      "/",
      "/contact/",
      "/services/"
    ],
    "formPages": [
      {
        "path": "/contact/",
        "expectedFormType": "gravity-forms",
        "submitTest": false
      }
    ],
    "ignoreNetworkPatterns": [
      "googletagmanager.com",
      "google-analytics.com",
      "klaviyo.com"
    ]
  }
]
```

---

# Running Tests

Set your Codespace or local environment URL:

```bash
export BASE_URL=https://your-codespace-url.github.dev
```

Run all tests:

```bash
npm run test
```

Run smoke tests only:

```bash
npm run test:smoke
```

Run form tests:

```bash
npm run test:forms
```

Run asset tests:

```bash
npm run test:assets
```

Run tests for a single site:

```bash
npm run test:site -- --site "Example Site"
```

---

# Suggested Workflow

## Before Updates

Run baseline screenshots/tests:

```bash
npm run baseline
```

## Perform Maintenance

* Update plugins
* Run composer update
* Apply changes

## After Updates

Run smoke tests:

```bash
npm run check
```

Review:

* Failed pages
* Console errors
* Network failures
* Screenshot diffs

If everything looks good:

* Commit changes
* Push changes
* Deploy

---

# Example Problems This Suite Can Catch

* Plugin update causes white screen
* Gravity Forms no longer renders
* Missing CSS after composer update
* Broken mobile navigation
* Theme rendering issues
* Missing JavaScript bundles
* Broken images
* Raw shortcodes displaying on frontend
* Maintenance mode accidentally left enabled

---

# Project Goals

This project intentionally prioritizes:

* Reliability
* Fast feedback
* Low false positives
* Maintainability
* Config-driven testing

This is not intended to be a full end-to-end testing framework.

The focus is practical maintenance QA for real-world WordPress agency workflows.

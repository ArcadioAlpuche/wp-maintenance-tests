const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const mode = process.argv[2];

if (!['baseline', 'check'].includes(mode)) {
  console.error('Usage: node utils/screenshot-comparison.js baseline|check');
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(projectRoot, 'sites.config.json');
const outputRoot = path.join(projectRoot, 'reports', 'screenshot-comparison');
const targetDir = path.join(outputRoot, mode === 'baseline' ? 'baseline' : 'current');

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const sites = JSON.parse(await fs.readFile(configPath, 'utf8'));
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    for (const site of sites) {
      const page = await browser.newPage({ ignoreHTTPSErrors: true });

      for (const pagePath of site.pages || []) {
        const url = new URL(pagePath, ensureTrailingSlash(site.baseUrl)).toString();
        await setCodespacesHeader(page, url);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await clearCodespacesWarning(page);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
        await page.screenshot({
          path: path.join(targetDir, `${slugify(site.siteName)}__${slugify(pagePath || 'home')}.png`),
          fullPage: true
        });
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (mode === 'check') {
    await writeComparisonReport();
  }
}

async function setCodespacesHeader(page, url) {
  const token = process.env.CODESPACES_BYPASS_TOKEN || process.env.GITHUB_TOKEN;
  const hostname = new URL(url).hostname;

  if (!token || (!hostname.endsWith('.app.github.dev') && !hostname.endsWith('.githubpreview.dev'))) {
    return;
  }

  await page.setExtraHTTPHeaders({ 'X-Github-Token': token });
}

async function clearCodespacesWarning(page) {
  const warningText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');

  if (!warningText.includes('You are about to access a development port served by')) {
    return;
  }

  const button = page.locator('button:has-text("Continue"), a:has-text("Continue"), input[value*="Continue" i]').first();

  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => undefined);
  }
}

async function writeComparisonReport() {
  const baselineDir = path.join(outputRoot, 'baseline');
  const currentDir = path.join(outputRoot, 'current');
  const files = Array.from(new Set([
    ...(await readPngFiles(baselineDir)),
    ...(await readPngFiles(currentDir))
  ])).sort();

  const rows = files.map((file) => {
    const baselinePath = path.join(baselineDir, file);
    const currentPath = path.join(currentDir, file);

    return `<tr>
      <td>${escapeHtml(file)}</td>
      <td>${imageCell(await exists(baselinePath), `baseline/${file}`)}</td>
      <td>${imageCell(await exists(currentPath), `current/${file}`)}</td>
    </tr>`;
  });

  await fs.writeFile(path.join(outputRoot, 'comparison-report.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Screenshot Comparison</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #17202a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d9dee5; padding: 10px; vertical-align: top; }
    th { background: #eef1f5; text-align: left; }
    img { max-width: 420px; border: 1px solid #d9dee5; }
  </style>
</head>
<body>
  <h1>Screenshot Comparison</h1>
  <table>
    <thead><tr><th>Page</th><th>Baseline</th><th>Current</th></tr></thead>
    <tbody>${rows.join('\n')}</tbody>
  </table>
</body>
</html>`, 'utf8');
}

async function readPngFiles(directory) {
  try {
    return (await fs.readdir(directory)).filter((file) => file.endsWith('.png'));
  } catch {
    return [];
  }
}

async function exists(filePath) {
  return fs.access(filePath).then(() => true).catch(() => false);
}

function imageCell(found, src) {
  return found ? `<img src="${escapeHtml(src)}" alt="">` : '<strong>Missing</strong>';
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/^\/$/, 'home')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

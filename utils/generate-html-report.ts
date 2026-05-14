import fs from 'node:fs/promises';
import path from 'node:path';
import type { MaintenanceResult } from './report-results';

async function globalTeardown(): Promise<void> {
  const reportsDir = path.resolve(__dirname, '..', 'reports');
  const resultsDir = path.join(reportsDir, 'maintenance-results');
  const outputPath = path.join(reportsDir, 'maintenance-report.html');

  await fs.mkdir(reportsDir, { recursive: true });

  const results = await readResults(resultsDir);
  const generatedAt = new Date().toISOString();

  await fs.writeFile(outputPath, renderHtml(results, generatedAt), 'utf8');
}

async function readResults(resultsDir: string): Promise<MaintenanceResult[]> {
  try {
    const files = await fs.readdir(resultsDir);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));
    const results = await Promise.all(
      jsonFiles.map(async (file) => JSON.parse(await fs.readFile(path.join(resultsDir, file), 'utf8')) as MaintenanceResult)
    );

    return results.sort((a, b) => `${a.siteName}${a.pageUrl}${a.testType}`.localeCompare(`${b.siteName}${b.pageUrl}${b.testType}`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function renderHtml(results: MaintenanceResult[], generatedAt: string): string {
  const passed = results.filter((result) => result.status === 'passed').length;
  const failed = results.filter((result) => result.status === 'failed').length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WordPress Maintenance Test Report</title>
  <style>
    body { color: #17202a; font-family: Arial, sans-serif; margin: 0; background: #f6f7f9; }
    header { background: #17202a; color: #fff; padding: 24px 32px; }
    main { padding: 24px 32px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 28px 0 12px; }
    .summary { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
    .metric { background: #fff; border: 1px solid #d9dee5; border-radius: 6px; padding: 12px 16px; min-width: 120px; }
    .metric strong { display: block; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9dee5; }
    th, td { border-bottom: 1px solid #e7eaf0; padding: 10px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eef1f5; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    tr.failed { background: #fff5f5; }
    tr.passed { background: #f7fff8; }
    code { background: #eef1f5; border-radius: 4px; padding: 2px 4px; }
    ul { margin: 0; padding-left: 18px; }
    .status { border-radius: 999px; display: inline-block; font-weight: 700; padding: 3px 8px; }
    .status.passed { background: #dff7e5; color: #176c2e; }
    .status.failed { background: #ffe1e1; color: #9d1c1c; }
    a { color: #1557b0; }
  </style>
</head>
<body>
  <header>
    <h1>WordPress Maintenance Test Report</h1>
    <div>Generated ${escapeHtml(generatedAt)}</div>
    <div class="summary">
      <div class="metric"><strong>${results.length}</strong>Total checks</div>
      <div class="metric"><strong>${passed}</strong>Passed</div>
      <div class="metric"><strong>${failed}</strong>Failed</div>
    </div>
  </header>
  <main>
    <h2>Results</h2>
    <table>
      <thead>
        <tr>
          <th>Site</th>
          <th>Type</th>
          <th>Page URL</th>
          <th>Status</th>
          <th>Findings</th>
          <th>Network</th>
          <th>Console</th>
          <th>WP Errors</th>
          <th>Broken Shortcodes</th>
          <th>Broken Images</th>
          <th>Forms</th>
          <th>Mobile Nav</th>
          <th>Internal Links</th>
          <th>Screenshots</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(renderResultRow).join('\n')}
      </tbody>
    </table>
  </main>
</body>
</html>`;
}

function renderResultRow(result: MaintenanceResult): string {
  return `<tr class="${result.status}">
  <td>${escapeHtml(result.siteName)}</td>
  <td>${escapeHtml(result.testType)}</td>
  <td><a href="${escapeAttr(result.pageUrl)}">${escapeHtml(result.pageUrl)}</a></td>
  <td><span class="status ${result.status}">${escapeHtml(result.status)}</span></td>
  <td>${renderList(result.notes)}</td>
  <td>${renderList(result.failedNetworkRequests.map((request) => `${request.resourceType} ${request.status ?? request.failureText ?? ''} ${request.url}`))}</td>
  <td>${renderList(result.consoleErrors.map((error) => error.text))}</td>
  <td>${renderList(result.wordpressErrors)}</td>
  <td>${renderList(result.brokenShortcodes ?? [])}</td>
  <td>${renderList(result.brokenImages.map(formatBrokenImage))}</td>
  <td>${renderObject(result.formDetection)}</td>
  <td>${renderObject(result.mobileNavResult)}</td>
  <td>${renderList((result.internalLinkResults ?? []).map(formatInternalLinkResult))}</td>
  <td>${renderList(result.screenshotPaths)}</td>
</tr>`;
}

function formatBrokenImage(image: unknown): string {
  if (!image || typeof image !== 'object') {
    return String(image);
  }

  const value = image as Record<string, unknown>;
  const details = [
    value.alt ? `alt="${String(value.alt)}"` : '',
    value.status ? `status=${String(value.status)}` : '',
    value.failureText ? `failure=${String(value.failureText)}` : '',
    value.reason ? `reason=${String(value.reason)}` : ''
  ].filter(Boolean);

  return `${String(value.src ?? '')}${details.length ? ` (${details.join(', ')})` : ''}`;
}

function formatInternalLinkResult(result: unknown): string {
  if (!result || typeof result !== 'object') {
    return String(result);
  }

  const value = result as Record<string, unknown>;
  return `${String(value.status ?? 'no response')} ${String(value.url ?? '')}`;
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return '';
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderObject(value: unknown): string {
  if (!value) {
    return '';
  }

  return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

export default globalTeardown;

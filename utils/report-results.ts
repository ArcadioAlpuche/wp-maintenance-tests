import fs from 'node:fs/promises';
import path from 'node:path';
import type { TestInfo } from '@playwright/test';
import type { FailedNetworkRequest, ConsoleError } from './network-monitor';
import type { FormDetectionResult } from './form-detectors';

export type MaintenanceResult = {
  testType: 'smoke' | 'forms' | 'assets';
  siteName: string;
  pageUrl: string;
  status: 'passed' | 'failed';
  httpStatus?: number | null;
  consoleErrors: ConsoleError[];
  failedNetworkRequests: FailedNetworkRequest[];
  wordpressErrors: string[];
  brokenImages: unknown[];
  formDetection: FormDetectionResult | null;
  screenshotPaths: string[];
  notes: string[];
};

export async function writeResult(result: MaintenanceResult, testInfo: TestInfo): Promise<void> {
  const resultsDir = path.resolve(__dirname, '..', 'reports', 'maintenance-results');
  await fs.mkdir(resultsDir, { recursive: true });

  const filename = `${sanitize(testInfo.titlePath.join('__'))}__${Date.now()}.json`;
  const filePath = path.join(resultsDir, filename);
  await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf8');

  await testInfo.attach('maintenance-result', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json'
  });
}

function sanitize(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 140);
}

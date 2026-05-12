import type { Page, Request } from '@playwright/test';

export type FailedNetworkRequest = {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  failureText?: string;
};

export type ConsoleError = {
  type: string;
  text: string;
  location?: string;
};

export type NetworkMonitor = {
  failedRequests: FailedNetworkRequest[];
  consoleErrors: ConsoleError[];
};

export function createNetworkMonitor(page: Page, ignorePatterns: string[] = []): NetworkMonitor {
  const monitor: NetworkMonitor = {
    failedRequests: [],
    consoleErrors: []
  };

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }

    const location = message.location();
    monitor.consoleErrors.push({
      type: message.type(),
      text: message.text(),
      location: location.url ? `${location.url}:${location.lineNumber}` : undefined
    });
  });

  page.on('requestfailed', (request) => {
    if (isIgnoredRequest(request, ignorePatterns)) {
      return;
    }

    monitor.failedRequests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      failureText: request.failure()?.errorText
    });
  });

  page.on('response', (response) => {
    const request = response.request();
    const status = response.status();

    if (status < 400 || isIgnoredRequest(request, ignorePatterns)) {
      return;
    }

    monitor.failedRequests.push({
      url: response.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      status
    });
  });

  return monitor;
}

export function isIgnoredUrl(url: string, ignorePatterns: string[] = []): boolean {
  return ignorePatterns.some((pattern) => url.toLowerCase().includes(pattern.toLowerCase()));
}

function isIgnoredRequest(request: Request, ignorePatterns: string[]): boolean {
  return isIgnoredUrl(request.url(), ignorePatterns);
}

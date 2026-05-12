const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const siteIndex = args.indexOf('--site');

if (siteIndex === -1 || !args[siteIndex + 1]) {
  console.error('Usage: npm run test:site -- --site "Example Site"');
  process.exit(1);
}

const siteName = args[siteIndex + 1];
const passthroughArgs = args.filter((_, index) => index !== siteIndex && index !== siteIndex + 1);
const playwrightCli = require.resolve('@playwright/test/cli');

const result = spawnSync(process.execPath, [playwrightCli, 'test', ...passthroughArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    WP_TEST_SITE: siteName
  }
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);

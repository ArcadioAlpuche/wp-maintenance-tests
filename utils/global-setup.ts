import fs from 'node:fs/promises';
import path from 'node:path';

async function globalSetup(): Promise<void> {
  await resetDirectory(path.resolve(__dirname, '..', 'reports', 'maintenance-results'));
  await resetDirectory(path.resolve(__dirname, '..', 'screenshots'), ['.gitkeep']);
}

async function resetDirectory(directory: string, keepFiles: string[] = []): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
  const entries = await fs.readdir(directory);

  await Promise.all(
    entries
      .filter((entry) => !keepFiles.includes(entry))
      .map((entry) => fs.rm(path.join(directory, entry), { recursive: true, force: true }))
  );
}

export default globalSetup;

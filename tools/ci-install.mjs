import { spawnSync } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * npm ci removes an existing node_modules before installing. If node_modules is
 * a symlink, npm (10/11) follows it and deletes the target directory's contents.
 * Refuse to run before npm gets a chance to touch it.
 */
export async function assertSafeNodeModules(cwd = process.cwd()) {
  const target = join(cwd, 'node_modules');
  try {
    const stats = await lstat(target);
    if (stats.isSymbolicLink()) {
      throw new Error('node_modules is a symbolic link; refusing to run npm ci');
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}

async function main() {
  try {
    await assertSafeNodeModules();
  } catch (error) {
    console.error(`[saiji] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['ci', ...process.argv.slice(2)], { stdio: 'inherit' });
  if (result.error) {
    console.error(`[saiji] failed to start npm: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

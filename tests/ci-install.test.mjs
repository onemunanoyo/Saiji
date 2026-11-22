import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertSafeNodeModules } from '../tools/ci-install.mjs';

test('refuses a symlinked node_modules', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'saiji-safe-install-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'victim'));
  try {
    await symlink('victim', join(dir, 'node_modules'), 'dir');
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'ENOSYS') {
      t.skip('symlinks are not available in this environment');
      return;
    }
    throw error;
  }

  await assert.rejects(() => assertSafeNodeModules(dir), /symbolic link/);
});

test('allows missing or real node_modules', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'saiji-safe-install-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  await assert.doesNotReject(() => assertSafeNodeModules(dir));
  await mkdir(join(dir, 'node_modules'));
  await assert.doesNotReject(() => assertSafeNodeModules(dir));
});

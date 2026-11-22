import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertInside,
  assertNoSymlinkComponents,
  assertNoSymlinksRecursive,
} from '../tools/safe-path.mjs';

async function temp(t) {
  const dir = await mkdtemp(join(tmpdir(), 'saiji-safe-path-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function link(t, target, path) {
  try {
    await symlink(target, path, 'file');
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'ENOSYS') {
      t.skip('symlinks are not available in this environment');
      return false;
    }
    throw error;
  }
  return true;
}

test('rejects a nested symlink', async t => {
  const dir = await temp(t);
  await writeFile(join(dir, 'secret.txt'), 'secret');
  if (!await link(t, join(dir, 'secret.txt'), join(dir, 'leak.txt'))) return;
  await assert.rejects(() => assertNoSymlinksRecursive(dir), /symbolic link/);
});

test('rejects a symlink in an intermediate path component', async t => {
  const dir = await temp(t);
  await mkdir(join(dir, 'victim'));
  if (!await link(t, join(dir, 'victim'), join(dir, 'link'))) return;
  await assert.rejects(() => assertNoSymlinkComponents(join(dir, 'link', 'child'), 'link/child', dir), /symbolic link/);
});

test('allows a regular tree', async t => {
  const dir = await temp(t);
  await mkdir(join(dir, 'nested'));
  await writeFile(join(dir, 'nested', 'file.txt'), 'ok');
  await assert.doesNotReject(() => assertNoSymlinksRecursive(dir));
  await assert.doesNotReject(() => assertNoSymlinkComponents(join(dir, 'nested', 'file.txt'), 'nested/file.txt', dir));
});

test('assertInside rejects a parent escape', async t => {
  const dir = await temp(t);
  assert.doesNotThrow(() => assertInside(dir, join(dir, 'child')));
  assert.throws(() => assertInside(dir, join(dir, '..', 'outside')), /outside/);
});

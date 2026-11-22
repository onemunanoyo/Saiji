import { lstat, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export async function assertNotSymlink(path, label = path) {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) throw new Error(`${label} is a symbolic link`);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function assertNoSymlinkComponents(path, label = path, start = process.cwd()) {
  const absolute = resolve(path);
  const base = resolve(start);
  const rel = relative(base, absolute);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error(`${label} is outside ${base}: ${absolute}`);
  }

  let current = base;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) throw new Error(`${label} contains a symbolic link: ${current}`);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
  }
}

export async function assertNoSymlinksRecursive(path, label = path) {
  let stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  if (stats.isSymbolicLink()) throw new Error(`${label} is a symbolic link`);
  if (!stats.isDirectory()) return;

  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${label} contains a symbolic link: ${child}`);
    if (entry.isDirectory()) await assertNoSymlinksRecursive(child, label);
  }
}

export async function assertRealpathWithin(path, root, label = path) {
  const [actual, actualRoot] = await Promise.all([realpath(path), realpath(root)]);
  const rel = relative(actualRoot, actual);
  if (rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))) return actual;
  throw new Error(`${label} resolves outside ${root}: ${actual}`);
}

export function assertInside(root, path, label = path) {
  const rel = relative(resolve(root), resolve(path));
  if (rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))) return;
  throw new Error(`${label} is outside ${root}: ${path}`);
}

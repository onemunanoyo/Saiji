import { zipSync } from 'fflate';
import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  assertInside,
  assertNoSymlinkComponents,
  assertNoSymlinksRecursive,
  assertNotSymlink,
} from './safe-path.mjs';

const root = 'release/extension';
const release = resolve('release');
const files = Object.create(null);

await assertNoSymlinkComponents(release, 'release');
await assertNoSymlinkComponents(resolve(root), 'release/extension');
await assertNoSymlinksRecursive(root, 'release/extension');

async function collect(directory = '') {
  for (const entry of await readdir(root + '/' + directory, { withFileTypes: true })) {
    const name = directory + entry.name;
    if (entry.isSymbolicLink()) throw Error('Unexpected symlink in store asset: ' + name);
    if (entry.isDirectory()) await collect(name + '/');
    else if (entry.isFile()) {
      if (/\.(map|onnx|safetensors|py)$/i.test(name) || name.startsWith('model/')) throw Error('Unexpected store asset: ' + name);
      files[name] = new Uint8Array(await readFile(root + '/' + name));
    } else {
      throw Error('Unexpected store asset type: ' + name);
    }
  }
}

await collect();
if (!files['manifest.json']) throw Error('Manifest must be at ZIP root');
const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
if (typeof manifest.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(manifest.version)) {
  throw Error('Invalid manifest version');
}

const bytes = zipSync(files, { level: 6 });
const path = `release/Saiji-${manifest.version}-store.zip`;
const output = resolve(path);
assertInside(release, output, 'Store ZIP');
await assertNoSymlinksRecursive(release, 'release');
await assertNotSymlink(output, 'Store ZIP');
const temporary = output + '.tmp';
await assertNotSymlink(temporary, 'Store ZIP temp');
await writeFile(temporary, bytes);
await rename(temporary, output);

const receiptPath = resolve('release/package-receipt.json');
assertInside(release, receiptPath, 'Store receipt');
await assertNotSymlink(receiptPath, 'Store receipt');
const receipt = JSON.stringify({
  path,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  files: Object.keys(files).sort(),
}, null, 2);
const receiptTemporary = receiptPath + '.tmp';
await assertNotSymlink(receiptTemporary, 'Store receipt temp');
await writeFile(receiptTemporary, receipt);
await rename(receiptTemporary, receiptPath);

console.log(`${path}: ${(bytes.length / 1024 / 1024).toFixed(2)} MiB; ${Object.keys(files).length} files`);

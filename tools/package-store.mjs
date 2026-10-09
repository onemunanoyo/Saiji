import { zipSync } from 'fflate';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'release/extension';
const files = {};
async function collect(directory = '') {
  for (const entry of await readdir(root + '/' + directory, { withFileTypes: true })) {
    const name = directory + entry.name;
    if (entry.isDirectory()) await collect(name + '/');
    else {
      if (/\.(map|onnx|safetensors|py)$/i.test(name) || name.startsWith('model/')) throw Error('Unexpected store asset: ' + name);
      files[name] = new Uint8Array(await readFile(root + '/' + name));
    }
  }
}
await collect();
if (!files['manifest.json']) throw Error('Manifest must be at ZIP root');
const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
const bytes = zipSync(files, { level: 6 });
const path = `release/Saiji-${manifest.version}-store.zip`;
await writeFile(path, bytes);
await writeFile('release/package-receipt.json', JSON.stringify({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),files:Object.keys(files).sort()},null,2));
console.log(`${path}: ${(bytes.length / 1024 / 1024).toFixed(2)} MiB; ${Object.keys(files).length} files`);

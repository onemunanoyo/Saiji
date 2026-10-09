import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const en = await json('public/_locales/en/messages.json');
test('Japanese, English and Korean locales cover the same keys and experimental disclosure', async () => {
  for (const locale of ['ja','en','ko']) {
    const messages = await json(`public/_locales/${locale}/messages.json`);
    assert.deepEqual(Object.keys(messages).sort(),Object.keys(en).sort());
    for (const value of Object.values(messages)) assert.ok(value.message.trim());
    assert.ok(messages.ai_experimental.message.length > 50);
    assert.ok(messages.ext_description.message.length <= 132);
  }
  assert.match(en.ai_experimental.message,/Japanese/);
  assert.match(en.ai_experimental.message,/other languages/);
});
test('AI options use localized strings and the default fallback is English', async () => {
  const source = await readFile('src/options/ToxicOptions.tsx','utf8');
  assert.doesNotMatch(source,/[ぁ-んァ-ヶ一-龯]/);
  for(const match of source.matchAll(/t\('([^']+)'/g)) assert.ok(en[match[1]],match[1]);
  const manifest=await json('public/manifest.json');
  assert.equal(manifest.default_locale,'en');
  assert.equal(manifest.permissions.includes('tabs'),false);
});
test('Store ZIP contains the runtime and privacy notice without model or development assets', async t => {
  let bytes;
  const manifest = await json('public/manifest.json');
  try { bytes = await readFile(`release/Saiji-${manifest.version}-store.zip`); }
  catch { t.skip('Run npm run package:store to verify ZIP');return; }
  const files=unzipSync(bytes);
  assert.ok(files['manifest.json']);assert.ok(files['privacy.html']);
  assert.equal(JSON.parse(new TextDecoder().decode(files['manifest.json'])).version, manifest.version);
  assert.ok(files['runtime/ort-wasm-simd-threaded.jsep.wasm']);
  assert.ok(files['runtime/ort-wasm-simd-threaded.jsep.mjs']);
  assert.ok(files['runtime/ort-wasm-simd-threaded.asyncify.mjs']);
  assert.ok(files['runtime/ort-wasm-simd-threaded.asyncify.wasm']);
  assert.ok(files['runtime/ort-wasm-simd-threaded.jspi.mjs']);
  assert.ok(files['runtime/ort-wasm-simd-threaded.jspi.wasm']);
  for(const name of Object.keys(files)) assert.doesNotMatch(name,/^(model|models|logs|node_modules|\.venv)/);
  for(const name of Object.keys(files)) assert.doesNotMatch(name,/\.(onnx|safetensors|map|py)$/);
  assert.ok(bytes.length < 50 * 1024 * 1024);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const storage = await load('src/shared/storage.ts');

function mockStorage(payload) {
  globalThis.chrome = {
    storage: {
      local: {
        get: async key => key == null ? payload : ({ [key]: payload[key] }),
      },
    },
  };
}

test('migrates v1.0 string entries and drops malformed NG words', async () => {
  mockStorage({
    ngWords: [
      'legacy_word',
      '  spaced  ',
      { word: 'live_word', platform: 'youtube' },
      null,
      {},
      { word: '   ', platform: 'both' },
      { word: 'bad_platform', platform: 'nope' },
    ],
  });

  assert.deepEqual(await storage.getStorage('ngWords'), [
    { word: 'legacy_word', platform: 'both' },
    { word: 'spaced', platform: 'both' },
    { word: 'live_word', platform: 'youtube_live' },
  ]);
});

test('cleans NG words through getStorageAll as well', async () => {
  mockStorage({ ngWords: ['legacy_word', { word: 'twitch_word', platform: 'twitch' }] });

  const all = await storage.getStorageAll();
  assert.deepEqual(all.ngWords, [
    { word: 'legacy_word', platform: 'both' },
    { word: 'twitch_word', platform: 'twitch' },
  ]);
  assert.equal(all.filterEnabled, true);
  assert.ok(all.toxicSettings);
});

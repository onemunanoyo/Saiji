import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const policy = await load('src/shared/toxic.ts');
const content = await load('src/content/toxic.ts');
const background = await load('src/background/toxic.ts');
const zero = () => Object.fromEntries(policy.TOXIC_LABELS.map(label => [label, 0]));

test('defaults are disabled and do not filter advice, politics, overall, or other-stream topics', () => {
  const scores = zero();
  scores.toxicity = scores.discrimination = scores.instruction = scores.pigeon = 1;
  assert.deepEqual(policy.matchingLabels(scores, { ...policy.DEFAULT_TOXIC_SETTINGS, enabled: true }), []);
  scores.threat = 0.6;
  assert.deepEqual(policy.matchingLabels(scores, { ...policy.DEFAULT_TOXIC_SETTINGS, enabled: true }), ['threat']);
  assert.deepEqual(policy.matchingLabels(scores, policy.DEFAULT_TOXIC_SETTINGS), []);
});

test('invalid settings and incomplete or nonfinite scores are rejected', () => {
  assert.deepEqual(policy.cleanToxicSettings({ enabled: true, thresholds: { threat: -1, spam: NaN, pigeon: 2, harassment: 0.9 } }),
      { enabled: true, thresholds: { harassment: 0.9 } });
  assert.equal(policy.parseScores({ threat: 1 }), null);
  assert.equal(policy.parseScores({ ...zero(), threat: NaN }), null);
  assert.equal(policy.parseScores({ ...zero(), spam: '0.8' }), null);
});

function element(text = 'hello') {
  const styleValues = new Map();
  return {
    tagName: 'DIV', isConnected: true, text, dataset: {},
    querySelector(selector) { return selector === '#message' ? { textContent: this.text } : null; },
    style: {
      getPropertyValue: key => styleValues.get(key)?.value ?? '',
      getPropertyPriority: key => styleValues.get(key)?.priority ?? '',
      setProperty: (key, value, priority = '') => styleValues.set(key, { value, priority }),
    },
  };
}
const state = () => ({ filterEnabled: true, toxicSettings: { enabled: true, thresholds: { threat: 0.6 } },
  bannedUsers: new Set(), violationCounter: new Map(), ngWords: [] });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('AI hides once, restores on disable, and adds no violation or ban', async () => {
  content.invalidateToxic();
  let calls = 0, filtered = 0;
  globalThis.chrome = { runtime: { sendMessage: async () => { calls++; return { ok: true, scores: { ...zero(), threat: 0.9 } }; } } };
  const node = element(), s = state();
  content.checkToxic(node, 'youtube', s, () => filtered++);
  content.checkToxic(node, 'youtube', s, () => filtered++);
  await tick();
  assert.equal(calls, 1);
  assert.equal(filtered, 1);
  assert.equal(node.style.getPropertyValue('display'), 'none');
  assert.equal(s.violationCounter.size, 0);
  assert.equal(s.bannedUsers.size, 0);
  content.invalidateToxic();
  assert.equal(node.style.getPropertyValue('display'), '');
});

test('pending AI results are ignored after remount, text reuse, removal, or filter disable', async () => {
  for (const invalidate of [() => content.invalidateToxic(), node => { node.text = 'changed'; },
    node => { node.isConnected = false; }, (_node, s) => { s.filterEnabled = false; }]) {
    content.invalidateToxic();
    let resolve;
    globalThis.chrome = { runtime: { sendMessage: () => new Promise(r => { resolve = r; }) } };
    const node = element(), s = state();
    content.checkToxic(node, 'youtube', s, () => assert.fail('stale result applied'));
    invalidate(node, s);
    resolve({ ok: true, scores: { ...zero(), threat: 1 } });
    await tick();
    assert.equal(node.style.getPropertyValue('display'), '');
  }
});

test('unavailable or malformed server leaves comments visible; NG-hidden comments are preserved', async () => {
  for (const response of [{ ok: false, error: 'unavailable' }, { ok: true, scores: {} }]) {
    content.invalidateToxic();
    globalThis.chrome = { runtime: { sendMessage: async () => response } };
    const node = element();
    content.checkToxic(node, 'youtube', state(), () => assert.fail('failed response hid comment'));
    await tick();
    assert.equal(node.style.getPropertyValue('display'), '');
  }
  content.invalidateToxic();
  globalThis.chrome = { runtime: { sendMessage: async () => ({ ok: true, scores: { ...zero(), threat: 1 } }) } };
  const node = element();
  content.checkToxic(node, 'youtube', state(), () => {});
  await tick();
  delete node.dataset.saijiToxic; // NGワード/手動ミュートが非表示を引き継ぐ
  content.invalidateToxic();
  assert.equal(node.style.getPropertyValue('display'), 'none');
});

test('reused AI-hidden DOM nodes are restored before classifying new text', async () => {
  content.invalidateToxic();
  globalThis.chrome = { runtime: { sendMessage: async () => ({ ok: true, scores: { ...zero(), threat: 1 } }) } };
  const node = element();
  content.checkToxic(node, 'youtube', state(), () => {});
  await tick();
  assert.equal(node.style.getPropertyValue('display'), 'none');
  node.text = 'new safe comment';
  globalThis.chrome.runtime.sendMessage = async () => ({ ok: true, scores: zero() });
  content.checkToxic(node, 'youtube', state(), () => {});
  await tick();
  assert.equal(node.style.getPropertyValue('display'), '');
});

test('background sends text only to fixed localhost, caches valid scores, and handles failures', async () => {
  let enabled = false, requests = 0;
  globalThis.chrome = { storage: { local: { get: async () => ({ toxicSettings: { enabled, thresholds: { threat: 0.6 } } }) } } };
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.equal(url, 'http://127.0.0.1:8765/judge');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { text: 'cache test' });
    return { ok: true, json: async () => ({ scores: zero() }) };
  };
  assert.equal((await background.judgeToxic('cache test')).error, 'disabled');
  assert.equal(requests, 0);
  enabled = true;
  assert.equal((await background.judgeToxic('cache test')).ok, true);
  assert.equal((await background.judgeToxic('cache test')).ok, true);
  assert.equal(requests, 1);
  globalThis.fetch = async () => { throw new Error('timeout'); };
  assert.equal((await background.judgeToxic('timeout test')).error, 'unavailable');
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ scores: { threat: 1 } }) });
  assert.equal((await background.judgeToxic('bad scores')).error, 'unavailable');
});

test('background bounds concurrent requests to four', async () => {
  globalThis.chrome = { storage: { local: { get: async () => ({ toxicSettings: { enabled: true, thresholds: {} } }) } } };
  const releases = [];
  globalThis.fetch = () => new Promise(resolve => releases.push(() => resolve({ ok: true, json: async () => ({ scores: zero() }) })));
  const pending = Array.from({ length: 4 }, (_, i) => background.judgeToxic(`busy ${i}`));
  await tick();
  assert.equal((await background.judgeToxic('overflow')).error, 'busy');
  releases.forEach(release => release());
  assert.ok((await Promise.all(pending)).every(result => result.ok));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const policy = await load('src/shared/toxic.ts');
const content = await load('src/content/toxic.ts');
const ruleFilter = await load('src/content/filter.ts');
const background = await load('src/background/toxic.ts');
const zero = () => Object.fromEntries(policy.TOXIC_LABELS.map(label => [label, 0]));

test('benchmark preset matches max of first five at frozen threshold', () => {
  const enabled = { ...policy.DEFAULT_TOXIC_SETTINGS, enabled: true };
  for (const label of policy.TOXIC_LABELS) {
    const scores = zero(); scores[label] = 0.005039215087890625;
    assert.equal(policy.matchingLabels(scores, enabled).length, policy.TOXIC_LABELS.indexOf(label) < 5 ? 1 : 0);
  }
  assert.deepEqual(policy.matchingLabels({ ...zero(), toxicity: 1 }, policy.DEFAULT_TOXIC_SETTINGS), []);
});

test('invalid settings and incomplete or nonfinite scores are rejected', () => {
  assert.deepEqual(policy.cleanToxicSettings({ enabled: true, thresholds: { threat: -1, spam: NaN, pigeon: 2, harassment: 0.9 } }),
      { enabled: true, backend: 'auto', downloadMissingModel: true, thresholds: { harassment: 0.9 } });
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

function mockBackground(enabled, sendMessage) {
  globalThis.chrome = {
    storage: { local: { get: async () => ({ toxicSettings: { enabled, backend: 'wasm', thresholds: {} } }) } },
    tabs: { query: async () => [{ url: 'https://www.youtube.com/watch?v=test' }] },
    offscreen: { hasDocument: async () => true },
    runtime: { sendMessage },
  };
  globalThis.fetch = () => assert.fail('background must not send comments over HTTP');
}
test('background uses the internal worker, caches scores, and handles failures', async () => {
  let requests = 0;
  const send = async message => {
    requests++;
    assert.equal(message.target, 'saiji-inference');
    assert.equal(message.preference, 'wasm');
    assert.equal(message.text, 'cache test');
    return { ok: true, scores: zero() };
  };
  mockBackground(false, send);
  assert.equal((await background.judgeToxic('cache test')).error, 'disabled');
  mockBackground(true, send);
  assert.equal((await background.judgeToxic('cache test')).ok, true);
  assert.equal((await background.judgeToxic('cache test')).ok, true);
  assert.equal(requests, 1);
  chrome.runtime.sendMessage = async () => { throw Error('worker failed'); };
  assert.equal((await background.judgeToxic('timeout test')).error, 'unavailable');
  chrome.runtime.sendMessage = async () => ({ ok: true, scores: { threat: 1 } });
  assert.equal((await background.judgeToxic('bad scores')).error, 'invalid_scores');
});
test('background bounds pending inference requests to 32', async () => {
  const releases = [];
  mockBackground(true, () => new Promise(resolve => releases.push(() => resolve({ ok: true, scores: zero() }))));
  const pending = Array.from({ length: 32 }, (_, i) => background.judgeToxic(`busy ${i}`));
  await tick();
  assert.equal((await background.judgeToxic('overflow')).error, 'busy');
  releases.forEach(release => release());
  assert.ok((await Promise.all(pending)).every(result => result.ok));
});

test('target matching accepts YouTube/Twitch but rejects lookalike hosts', () => {
  assert.equal(background.isToxicTarget('https://www.youtube.com/watch?v=x'), true);
  assert.equal(background.isToxicTarget('https://m.twitch.tv/channel'), true);
  assert.equal(background.isToxicTarget('https://youtube.com.evil.example/'), false);
  assert.equal(background.isToxicTarget('https://example.com/?youtube.com'), false);
});
test('no target or disabled global filter prevents model creation', async () => {
  mockBackground(true, () => assert.fail('must not create inference request'));
  chrome.tabs.query = async () => [];
  assert.equal((await background.toxicHealth()).error, 'idle');
  assert.equal((await background.judgeToxic('idle comment')).error, 'idle');
  chrome.tabs.query = async () => [{ url: 'https://twitch.tv/channel', discarded: true }];
  assert.equal((await background.toxicHealth()).error, 'idle');
  chrome.tabs.query = async () => [{ url: 'https://youtube.com/watch?v=x' }];
  chrome.storage.local.get = async () => ({ toxicSettings: { enabled: true }, filterEnabled: false });
  assert.equal((await background.toxicHealth()).error, 'idle');
});
test('last target removal releases worker and host but leaves persistent model cache untouched', async () => {
  let disposals=0,closed=0;
  mockBackground(true, async message => { assert.equal(message.action, 'dispose'); disposals++;return {ok:true}; });
  chrome.offscreen.closeDocument=async()=>{closed++;};
  await background.reconcileToxicLifecycle();
  assert.equal(closed,0);
  chrome.tabs.query=async()=>[];
  await background.reconcileToxicLifecycle();
  assert.equal(disposals,1);assert.equal(closed,1);
});
test('disabled AI releases model even with a target tab still open', async () => {
  let closed=0;
  mockBackground(false,async()=>({ok:true}));
  chrome.offscreen.closeDocument=async()=>{closed++;};
  await background.reconcileToxicLifecycle();
  assert.equal(closed,1);
});

test('rule-hidden comments never reach inference, including repeated DOM processing', async () => {
  content.invalidateToxic();
  globalThis.document={querySelector:()=>null};globalThis.location={hostname:'youtube.com'};
  globalThis.chrome={runtime:{sendMessage:()=>assert.fail('rule-hidden text sent to classifier')}};
  const s=state();s.ngWords=[{word:'blocked',platform:'both'}];
  const node=element('blocked comment');
  assert.equal(ruleFilter.processElement(node,'youtube',s,()=>{}).removed,true);
  content.checkToxic(node,'youtube',s,()=>assert.fail('AI counted a rule removal'));
  content.checkToxic(node,'youtube',s,()=>assert.fail('AI counted a repeated rule removal'));
  await tick();assert.equal(node.style.getPropertyValue('display'),'none');
});
test('comments hidden by a parent thread never reach inference', async () => {
  content.invalidateToxic();
  globalThis.chrome={runtime:{sendMessage:()=>assert.fail('hidden child sent to classifier')}};
  const parent=element();parent.style.setProperty('display','none','important');
  const child=element('child comment');child.parentElement=parent;
  content.checkToxic(child,'youtube',state(),()=>assert.fail('hidden child counted'));
  await tick();
});
test('visible comments surviving rules still reach inference', async () => {
  content.invalidateToxic();
  globalThis.document={querySelector:()=>null};globalThis.location={hostname:'youtube.com'};
  let calls=0;globalThis.chrome={runtime:{sendMessage:async()=>{calls++;return {ok:true,scores:zero()};}}};
  const s=state();s.ngWords=[{word:'blocked',platform:'both'}];const node=element('ordinary comment');
  assert.equal(ruleFilter.processElement(node,'youtube',s,()=>{}).removed,false);
  content.checkToxic(node,'youtube',s,()=>assert.fail('safe comment hidden'));await tick();
  assert.equal(calls,1);assert.equal(node.style.getPropertyValue('display'),'');
});
test('a parent hidden while inference is pending prevents an AI hide or count', async () => {
  content.invalidateToxic();let resolve;
  globalThis.chrome={runtime:{sendMessage:()=>new Promise(r=>{resolve=r;})}};
  const parent=element();const child=element();child.parentElement=parent;let counted=0;
  content.checkToxic(child,'youtube',state(),()=>counted++);
  parent.style.setProperty('display','none','important');
  resolve({ok:true,scores:{...zero(),threat:1}});await tick();
  assert.equal(counted,0);assert.equal(child.dataset.saijiToxic,undefined);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/content/commentLock.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const lock = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

class FakeObserver {
  static instances = [];
  constructor(callback) {
    this.callback = callback;
    this.connected = false;
    FakeObserver.instances.push(this);
  }
  observe(target) {
    this.connected = true;
    this.target = target;
  }
  disconnect() {
    this.connected = false;
  }
}

function fakeElement() {
  return {
    listeners: [],
    attributes: new Map(),
    addEventListener(type, listener, capture) { this.listeners.push({ type, listener, capture }); },
    removeEventListener(type, listener, capture) {
      this.listeners = this.listeners.filter(item => !(item.type === type && item.listener === listener && item.capture === capture));
    },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  };
}

test('a successful mount creates one observer and does not arm the retry interval', () => {
  const original = {
    document: globalThis.document,
    MutationObserver: globalThis.MutationObserver,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };
  const button = fakeElement();
  const input = fakeElement();
  const parent = fakeElement();
  let intervalCallback = null;

  FakeObserver.instances = [];
  globalThis.MutationObserver = FakeObserver;
  globalThis.document = {
    querySelector(selector) {
      if (selector === '[data-a-target="chat-send-button"]') return button;
      if (selector === '[data-a-target="chat-input"]') return input;
      if (selector === '.chat-input__buttons-container') return parent;
      return null;
    },
  };
  globalThis.setInterval = callback => { intervalCallback = callback; return 1; };
  globalThis.clearInterval = () => { intervalCallback = null; };

  try {
    lock.mountCommentLock('twitch');
    assert.equal(intervalCallback, null);
    assert.equal(FakeObserver.instances.length, 1);
    assert.equal(FakeObserver.instances[0].connected, true);
    assert.equal(button.attributes.get('disabled'), '');

    lock.dismountCommentLock();
    assert.equal(FakeObserver.instances[0].connected, false);
    assert.equal(button.attributes.has('disabled'), false);
  } finally {
    globalThis.document = original.document;
    globalThis.MutationObserver = original.MutationObserver;
    globalThis.setInterval = original.setInterval;
    globalThis.clearInterval = original.clearInterval;
  }
});

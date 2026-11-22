import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const selectors = await load('src/shared/selectors.ts');
const filter = await load('src/content/filter.ts');

// Twitch の行は「投稿者名 + 本文」を含むため、本文だけを抽出できるか確認する。
function twitchMessage({ body = 'sample message', username = 'user_name', bodySelector = true } = {}) {
  const bodyEl = { textContent: ` ${body} ` };
  const userEl = {
    textContent: username,
    getAttribute: name => name === 'data-a-user' ? username : null,
  };
  const line = {
    tagName: 'DIV',
    dataset: {},
    textContent: `${username}: ${body}`,
    matches: selector => selector === '.chat-line__message',
    querySelector(selector) {
      if (selector === '[data-a-user]') return userEl;
      if (selector.includes('chat-line-message-body')) return bodySelector ? bodyEl : null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.text-fragment, .mention-fragment') {
        return bodySelector ? [] : [{ textContent: body }];
      }
      return [];
    },
    style: { setProperty() {} },
  };
  const wrapper = {
    tagName: 'DIV',
    dataset: {},
    textContent: line.textContent,
    matches: () => false,
    querySelector(selector) {
      if (selector === '.chat-line__message') return line;
      if (selector === '[data-a-user]') return userEl;
      return null;
    },
    querySelectorAll: () => [],
    style: { setProperty() {} },
  };
  return { line, wrapper };
}

test('Twitch: wrapper text excludes the author name', () => {
  const { wrapper } = twitchMessage();
  assert.equal(selectors.getMessageText(wrapper, 'twitch'), 'sample message');
});

test('Twitch: the line element itself can be the observed node', () => {
  const { line } = twitchMessage();
  assert.equal(selectors.getMessageText(line, 'twitch'), 'sample message');
});

test('Twitch: falls back to text fragments without the author name', () => {
  const { line } = twitchMessage({ bodySelector: false });
  assert.equal(selectors.getMessageText(line, 'twitch'), 'sample message');
});

test('Twitch: a line with no body text yields an empty string', () => {
  const { line } = twitchMessage({ body: '', bodySelector: false });
  assert.equal(selectors.getMessageText(line, 'twitch'), '');
});

test('YouTube: live and normal message selectors are unchanged', () => {
  const live = {
    tagName: 'DIV',
    querySelector: selector => selector === '#message' ? { textContent: ' live message ' } : null,
  };
  const normal = {
    tagName: 'YTD-COMMENT-RENDERER',
    querySelector: selector => selector === '#content-text' ? { textContent: ' normal message ' } : null,
  };
  assert.equal(selectors.getMessageText(live, 'youtube'), 'live message');
  assert.equal(selectors.getMessageText(normal, 'youtube'), 'normal message');
});

globalThis.location = { hostname: 'twitch.tv' };
globalThis.document = { querySelector: () => null };

function state(word) {
  return {
    filterEnabled: true,
    toxicSettings: { enabled: false, thresholds: {} },
    bannedUsers: new Set(),
    violationCounter: new Map(),
    ngWords: [{ word, platform: 'twitch' }],
  };
}

test('Twitch: an NG word matching the author name does not hide the comment', () => {
  const { wrapper } = twitchMessage();
  const result = filter.processElement(wrapper, 'twitch', state('user_name'), () => {});
  assert.equal(result.removed, false);
});

test('Twitch: an NG word matching the body still hides the comment', () => {
  const { wrapper } = twitchMessage();
  const result = filter.processElement(wrapper, 'twitch', state('sample message'), () => {});
  assert.equal(result.removed, true);
});

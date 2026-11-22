import type { Platform } from '../shared/types';
import { getChatDocument } from '../shared/selectors';
import { isImeComposing } from '../shared/keyboard';

// YouTube/Twitch それぞれの送信ボタン・入力欄セレクタ
const LOCK_SELECTORS = {
  youtube: {
    sendButton: '#send-button button',
    input:      '#input[contenteditable]',
    // ボタンが再生成される可能性があるため、その親を監視する
    watchParent: 'yt-live-chat-message-input-renderer',
  },
  twitch: {
    sendButton: '[data-a-target="chat-send-button"]',
    input:      '[data-a-target="chat-input"]',
    watchParent: '.chat-input__buttons-container',
  },
} as const;

let rerenderObserver: MutationObserver | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let lockedPlatform: Platform | null = null;

// click / Enter キーをキャプチャフェーズでキャンセル
function blockClick(e: Event): void {
  e.preventDefault();
  e.stopImmediatePropagation();
}

function blockEnter(e: Event): void {
  const keyboard = e as KeyboardEvent;
  if (isImeComposing(keyboard)) return;
  if (keyboard.key !== 'Enter') return;
  e.preventDefault();
  e.stopImmediatePropagation();
}

function applyToElements(doc: Document, platform: Platform): boolean {
  const sel = LOCK_SELECTORS[platform];
  const btn   = doc.querySelector<HTMLButtonElement>(sel.sendButton);
  const input = doc.querySelector<HTMLElement>(sel.input);

  if (!btn && !input) return false;

  if (btn) {
    btn.addEventListener('click', blockClick, true);
    btn.setAttribute('disabled', '');
  }
  if (input) {
    input.addEventListener('keydown', blockEnter, true);
  }
  return true;
}

function removeFromElements(doc: Document, platform: Platform): void {
  const sel = LOCK_SELECTORS[platform];
  const btn   = doc.querySelector<HTMLButtonElement>(sel.sendButton);
  const input = doc.querySelector<HTMLElement>(sel.input);

  if (btn) {
    btn.removeEventListener('click', blockClick, true);
    btn.removeAttribute('disabled');
  }
  if (input) {
    input.removeEventListener('keydown', blockEnter, true);
  }
}

function startRerenderWatch(doc: Document, platform: Platform): void {
  const sel = LOCK_SELECTORS[platform];
  const parent = doc.querySelector(sel.watchParent);
  if (!parent) return;

  rerenderObserver = new MutationObserver(() => {
    // 再レンダリングでボタンが再生成されたら再適用
    applyToElements(doc, platform);
  });
  rerenderObserver.observe(parent, { childList: true, subtree: true });
}

export function mountCommentLock(platform: Platform): void {
  // 二重マウント防止
  if (lockedPlatform) dismountCommentLock();

  lockedPlatform = platform;

  let attempts = 0;
  const MAX_ATTEMPTS = 20; // 最大10秒待機

  function tryMount(): void {
    const doc = getChatDocument(platform);
    if (!doc) {
      // iframe がまだ読み込まれていない場合はリトライ
      if (++attempts < MAX_ATTEMPTS) return;
      clearRetry();
      return;
    }

    const ok = applyToElements(doc, platform);
    if (!ok && ++attempts < MAX_ATTEMPTS) return;

    clearRetry();
    if (ok) startRerenderWatch(doc, platform);
  }

  tryMount();
  if (lockedPlatform) {
    retryTimer = setInterval(tryMount, 500);
  }
}

export function dismountCommentLock(): void {
  clearRetry();

  rerenderObserver?.disconnect();
  rerenderObserver = null;

  if (lockedPlatform) {
    const doc = getChatDocument(lockedPlatform);
    if (doc) removeFromElements(doc, lockedPlatform);
    lockedPlatform = null;
  }
}

function clearRetry(): void {
  if (retryTimer !== null) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

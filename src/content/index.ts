import type { Message } from '../shared/types';
import { getStorageAll, setStorage } from '../shared/storage';
import { detectPlatform, detectWatchMode, getNormalCommentContainer, getAuthorId } from '../shared/selectors';
import type { FilterState } from '../shared/types';
import { mountObserver, dismountObserver } from './observer';
import { mountCommentLock, dismountCommentLock } from './commentLock';
import { DEFAULT_TOXIC_SETTINGS } from '../shared/toxic';
import { invalidateToxic } from './toxic';

const _platform = detectPlatform();
if (!_platform) throw new Error('[Saiji] 対象外プラットフォーム');
const platform = _platform;

const state: FilterState = {
  ngWords:          [],
  bannedUsers:      new Set(),
  violationCounter: new Map(),
  filterEnabled:    true,
  toxicSettings: structuredClone(DEFAULT_TOXIC_SETTINGS),
};

let sessionFiltered = 0;
let commentLockEnabled = false;

// 通常コメント手動ブロック用の状態
let lastClickedCommentUser: { authorId: string; element: HTMLElement } | null = null;
let menuObserver: MutationObserver | null = null;

async function init(): Promise<void> {
  const storage = await getStorageAll();
  state.ngWords       = storage.ngWords;
  state.bannedUsers   = new Set(storage.bannedIds);
  state.filterEnabled = storage.filterEnabled;
  state.toxicSettings = storage.toxicSettings;
  sessionFiltered     = storage.sessionFiltered ?? 0;
  commentLockEnabled  = storage.commentLockEnabled ?? false;

  const mode = detectWatchMode();
  console.info(`[Saiji] 起動 (${platform} / ${mode})`);
  mountObserver(platform, mode, state, handleFiltered, handleBan);
  if (commentLockEnabled) mountCommentLock(platform);

  if (platform === 'youtube') {
    startMenuWatch();
  }
}

function handleFiltered(): void {
  sessionFiltered++;
  void setStorage('sessionFiltered', sessionFiltered);
}

function handleBan(authorId: string): void {
  const msg: Message = { type: 'ADD_TO_BLACKLIST', authorId };
  chrome.runtime.sendMessage(msg);
}

// ミュートされたユーザーの既存コメントを即時非表示
function hideBannedComments(): void {
  if (platform !== 'youtube') return;
  const container = getNormalCommentContainer();
  if (!container) return;

  // 親スレッド全体を非表示
  container.querySelectorAll('ytd-comment-thread-renderer').forEach(thread => {
    const aid = getAuthorId(thread, platform);
    if (aid && state.bannedUsers.has(aid)) {
      delete (thread as HTMLElement).dataset.saijiToxic;
      (thread as HTMLElement).style.setProperty('display', 'none', 'important');
    }
  });

  // 個別コメント（返信等）を非表示
  container.querySelectorAll('ytd-comment-renderer').forEach(comment => {
    const aid = getAuthorId(comment, platform);
    if (aid && state.bannedUsers.has(aid)) {
      delete (comment as HTMLElement).dataset.saijiToxic;
      (comment as HTMLElement).style.setProperty('display', 'none', 'important');
    }
  });
}

function startMenuWatch(): void {
  if (menuObserver) return;

  // 点3つメニューのクリック監視（キャプチャフェーズ）
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const menuBtn = target.closest('ytd-menu-renderer yt-icon-button button, ytd-menu-renderer yt-icon-button');
    if (menuBtn) {
      const commentEl = target.closest('ytd-comment-renderer');
      if (commentEl) {
        const authorId = getAuthorId(commentEl, platform);
        if (authorId) {
          lastClickedCommentUser = {
            authorId,
            element: commentEl as HTMLElement
          };
        }
      }
    }
  }, true);

  // ポップアップメニュー出現監視
  menuObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        const popup = node.tagName.toLowerCase() === 'ytd-menu-popup-renderer'
          ? node
          : node.querySelector('ytd-menu-popup-renderer');
        if (popup) {
          injectMuteMenuItem(popup);
        }
      }
    }
  });
  menuObserver.observe(document.body, { childList: true, subtree: true });
}

function injectMuteMenuItem(popup: Element): void {
  if (popup.querySelector('#saiji-mute-menu-item')) return;

  const listbox = popup.querySelector('tp-yt-paper-listbox');
  if (!listbox) return;

  const item = document.createElement('ytd-menu-service-item-renderer');
  item.id = 'saiji-mute-menu-item';
  item.setAttribute('role', 'menuitem');
  item.setAttribute('tabindex', '-1');
  item.setAttribute('aria-selected', 'false');
  item.className = 'style-scope ytd-menu-popup-renderer';

  const muteText = chrome.i18n.getMessage('mute_user') || 'ユーザーをミュート';
  item.innerHTML = `
    <tp-yt-paper-item class="style-scope ytd-menu-service-item-renderer" role="option">
      <span class="style-scope ytd-menu-service-item-renderer" style="font-size: 14px; padding: 0 8px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
        <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-4.9L7.69 5.69C9.04 4.63 10.74 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
        </svg>
        <span>${muteText}</span>
      </span>
    </tp-yt-paper-item>
  `;

  item.addEventListener('click', () => {
    if (lastClickedCommentUser) {
      const { authorId, element } = lastClickedCommentUser;
      
      // BANリストに追加
      handleBan(authorId);
      
      // クリックされたコメントおよびツリー全体を即時非表示
      const threadEl = element.closest('ytd-comment-thread-renderer');
      if (threadEl) {
        (threadEl as HTMLElement).style.setProperty('display', 'none', 'important');
      } else {
        (element as HTMLElement).style.setProperty('display', 'none', 'important');
      }

      // 同一ユーザー의コメントをすべて隠す
      state.bannedUsers.add(authorId);
      hideBannedComments();

      // メニューを閉じる
      const dropdown = popup.closest('tp-yt-iron-dropdown');
      if (dropdown) {
        (dropdown as any).opened = false;
      }
    }
  });

  listbox.appendChild(item);
}

chrome.runtime.onMessage.addListener((msg: Message) => {
  if (!platform) return;
  switch (msg.type) {
    case 'SYNC_TOXIC_SETTINGS':
      invalidateToxic();
      state.toxicSettings = msg.settings;
      break;
    case 'REMOUNT_OBSERVER': {
      const mode = detectWatchMode();
      mountObserver(platform, mode, state, handleFiltered, handleBan);
      if (commentLockEnabled) mountCommentLock(platform);
      break;
    }
    case 'SYNC_BLACKLIST':
      state.bannedUsers = new Set(msg.bannedIds);
      hideBannedComments(); // 同期されたら既存のものを隠す
      break;
    case 'SYNC_NG_WORDS':
      state.ngWords = msg.ngWords;
      break;
    case 'RESET_COUNTER':
      state.violationCounter.clear();
      break;
    case 'CLEAR_BLACKLIST':
      state.bannedUsers.clear();
      break;
    case 'TOGGLE_FILTER':
      state.filterEnabled = msg.enabled;
      if (!msg.enabled) {
        dismountObserver();
      } else {
        const mode = detectWatchMode();
        mountObserver(platform, mode, state, handleFiltered, handleBan);
      }
      break;
    case 'TOGGLE_COMMENT_LOCK':
      commentLockEnabled = msg.enabled;
      if (msg.enabled) {
        mountCommentLock(platform);
      } else {
        dismountCommentLock();
      }
      break;
  }
});

void init();

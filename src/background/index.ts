import type { Message, StatsResponse } from '../shared/types';
import {
  ALARM_RESET_COUNTER,
  ALARM_CLEAR_BLACKLIST,
} from '../shared/types';
import {
  addBannedId,
  clearBlacklist,
  getStorage,
  getStorageAll,
  setStorage,
  DEFAULT_STORAGE,
} from '../shared/storage';

// ── alarm を確実に登録するユーティリティ ─────────────────
async function ensureAlarms(): Promise<void> {
  const alarms = await chrome.alarms.getAll();
  const names  = alarms.map(a => a.name);

  if (!names.includes(ALARM_RESET_COUNTER)) {
    chrome.alarms.create(ALARM_RESET_COUNTER,  { periodInMinutes: 15 });
  }
  if (!names.includes(ALARM_CLEAR_BLACKLIST)) {
    chrome.alarms.create(ALARM_CLEAR_BLACKLIST, { periodInMinutes: 60 * 24 * 7 });
  }
}

// ── インストール時初期化 ──────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getStorageAll();
  // 既存キーは上書きしない
  const merged = { ...DEFAULT_STORAGE, ...existing };
  await chrome.storage.local.set(merged);

  await ensureAlarms();
  console.info('[Saiji BG] インストール完了・alarm 登録済み');
});

// ── ブラウザ再起動時：alarm が消えていたら再登録 ──────────
chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarms();
  console.info('[Saiji BG] 起動確認・alarm チェック済み');
});

// ── alarm ─────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === ALARM_RESET_COUNTER) {
    broadcastToAllTabs({ type: 'RESET_COUNTER' });
  }

  if (alarm.name === ALARM_CLEAR_BLACKLIST) {
    await clearBlacklist();
    broadcastToAllTabs({ type: 'CLEAR_BLACKLIST' });
    console.info('[Saiji BG] ブラックリスト週次リセット完了');
  }
});

// ── SPA 遷移検知 ──────────────────────────────────────────
chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
  const url = details.url;
  if (url.includes('youtube.com/watch') || /twitch\.tv\/[^/]+$/.test(url)) {
    chrome.tabs.sendMessage(details.tabId, { type: 'REMOUNT_OBSERVER' } satisfies Message)
        .catch(() => { /* CS 未注入タブは無視 */ });
  }
});

// ── メッセージ受信 ────────────────────────────────────────
chrome.runtime.onMessage.addListener(
    (msg: Message, _sender, sendResponse) => {
      handleMessage(msg, sendResponse);
      return true; // 非同期 sendResponse のため
    }
);

async function handleMessage(
    msg: Message,
    sendResponse: (r?: unknown) => void,
): Promise<void> {
  switch (msg.type) {

    case 'ADD_TO_BLACKLIST': {
      await addBannedId(msg.authorId);
      const bannedIds = await getStorage('bannedIds');
      broadcastToAllTabs({ type: 'SYNC_BLACKLIST', bannedIds });
      sendResponse();
      break;
    }

    case 'GET_STATS': {
      const [filtered, bannedIds] = await Promise.all([
        getStorage('sessionFiltered'),
        getStorage('bannedIds'),
      ]);
      const res: StatsResponse = { filtered, banned: bannedIds.length };
      sendResponse(res);
      break;
    }

    case 'TOGGLE_FILTER': {
      await setStorage('filterEnabled', msg.enabled);
      broadcastToAllTabs(msg);
      sendResponse();
      break;
    }

    default:
      sendResponse();
  }
}

// ── storage 変更監視（NGワード変更を CS に伝播）────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes['ngWords']) {
    broadcastToAllTabs({
      type: 'SYNC_NG_WORDS',
      ngWords: changes['ngWords'].newValue as string[],
    });
  }
});

// ── ユーティリティ ────────────────────────────────────────
async function broadcastToAllTabs(msg: Message): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
      tabs.map(tab => {
        if (!tab.id) return Promise.resolve();
        return chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      })
  );
}
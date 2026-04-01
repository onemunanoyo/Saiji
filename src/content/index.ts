import type { Message, FilterState } from '../shared/types';
import { getStorageAll, setStorage } from '../shared/storage';
import { detectPlatform } from '../shared/selectors';
import { mountObserver, dismountObserver } from './observer';

// ── 初期化 ────────────────────────────────────────────────
const platform = detectPlatform();

const state: FilterState = {
  ngWords:          [],
  bannedUsers:      new Set<string>(),
  violationCounter: new Map<string, number>(),
  filterEnabled:    true,
  sessionFiltered:  0,
};

async function init(): Promise<void> {
  // プラットフォームが特定できない場合は何もしない
  if (!platform) return;

  const storage = await getStorageAll();
  state.ngWords         = storage.ngWords;
  state.bannedUsers     = new Set(storage.bannedIds);
  state.filterEnabled   = storage.filterEnabled;
  state.sessionFiltered = storage.sessionFiltered ?? 0;

  mountObserver(platform, state, handleFiltered, handleBan);
}

// ── コールバック ──────────────────────────────────────────
function handleFiltered(): void {
  // セッション中の非表示件数をインクリメント
  state.sessionFiltered++;
  void setStorage('sessionFiltered', state.sessionFiltered);
}

function handleBan(authorId: string): void {
  const msg: Message = { type: 'ADD_TO_BLACKLIST', authorId };
  void chrome.runtime.sendMessage(msg);
}

// ── メッセージ受信 ────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg: Message) => {
  if (!platform) return;

  switch (msg.type) {
    case 'REMOUNT_OBSERVER':
      mountObserver(platform, state, handleFiltered, handleBan);
      break;

    case 'SYNC_BLACKLIST':
      state.bannedUsers = new Set(msg.bannedIds);
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
        mountObserver(platform, state, handleFiltered, handleBan);
      }
      break;
  }
});

void init();

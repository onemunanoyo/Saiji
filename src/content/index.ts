import type { Message } from '../shared/types';
import { getStorageAll, setStorage } from '../shared/storage';
import { detectPlatform, detectWatchMode } from '../shared/selectors';
import type { FilterState } from '../shared/types';
import { mountObserver, dismountObserver } from './observer';

const _platform = detectPlatform();
if (!_platform) throw new Error('[Saiji] 対象外プラットフォーム');
const platform = _platform;

const state: FilterState = {
  ngWords:          [],
  bannedUsers:      new Set(),
  violationCounter: new Map(),
  filterEnabled:    true,
};

let sessionFiltered = 0;

async function init(): Promise<void> {
  const storage = await getStorageAll();
  state.ngWords       = storage.ngWords;
  state.bannedUsers   = new Set(storage.bannedIds);
  state.filterEnabled = storage.filterEnabled;
  sessionFiltered     = storage.sessionFiltered ?? 0;

  const mode = detectWatchMode();
  console.info(`[Saiji] 起動 (${platform} / ${mode})`);
  mountObserver(platform, mode, state, handleFiltered, handleBan);
}

function handleFiltered(): void {
  sessionFiltered++;
  void setStorage('sessionFiltered', sessionFiltered);
}

function handleBan(authorId: string): void {
  const msg: Message = { type: 'ADD_TO_BLACKLIST', authorId };
  chrome.runtime.sendMessage(msg);
}

chrome.runtime.onMessage.addListener((msg: Message) => {
  if (!platform) return;
  switch (msg.type) {
    case 'REMOUNT_OBSERVER': {
      const mode = detectWatchMode();
      mountObserver(platform, mode, state, handleFiltered, handleBan);
      break;
    }
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
        const mode = detectWatchMode();
        mountObserver(platform, mode, state, handleFiltered, handleBan);
      }
      break;
  }
});

void init();
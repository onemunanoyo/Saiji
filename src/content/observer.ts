import type { Platform, WatchMode } from '../shared/types';
import { getChatContainer } from '../shared/selectors';
import type { FilterState } from '../shared/types';
import { processElement } from './filter';

const RETRY_INTERVAL_MS = 1000;
const RETRY_MAX         = 20;

// YouTube の非同期描画を待つ遅延（ms）
const PROCESS_DELAY: Record<Platform, number> = {
  youtube: 200,
  twitch:  0,
};

let observer: MutationObserver | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function mountObserver(
    platform: Platform,
    mode: WatchMode,
    state: FilterState,
    onFiltered: () => void,
    onBan: (authorId: string) => void,
): void {
  dismountObserver();
  attemptMount(platform, mode, state, onFiltered, onBan, 0);
}

export function dismountObserver(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function attemptMount(
    platform: Platform,
    mode: WatchMode,
    state: FilterState,
    onFiltered: () => void,
    onBan: (authorId: string) => void,
    attempt: number,
): void {
  const container = getChatContainer(platform);

  if (!container) {
    if (attempt >= RETRY_MAX) {
      console.warn(`[Saiji] チャット欄が見つかりませんでした (${platform})`);
      return;
    }
    retryTimer = setTimeout(
        () => attemptMount(platform, mode, state, onFiltered, onBan, attempt + 1),
        RETRY_INTERVAL_MS,
    );
    return;
  }

  if (mode === 'archive') {
    mountArchiveObserver(platform, container, state, onFiltered, onBan);
  } else {
    mountLiveObserver(platform, container, state, onFiltered, onBan);
  }

  console.info(`[Saiji] Observer マウント完了 (${platform} / ${mode})`);
}

/** ライブ配信用：新規追加コメントを監視 */
function mountLiveObserver(
    platform: Platform,
    container: Element,
    state: FilterState,
    onFiltered: () => void,
    onBan: (authorId: string) => void,
): void {
  const delay = PROCESS_DELAY[platform];

  observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (delay > 0) {
          setTimeout(() => {
            const result = processElement(node, platform, state, onBan);
            if (result.removed) onFiltered();
          }, delay);
        } else {
          const result = processElement(node, platform, state, onBan);
          if (result.removed) onFiltered();
        }
      }
    }
  });

  observer.observe(container, { childList: true, subtree: false });
}

/** アーカイブ用：既存コメントを一括スキャン＋スクロール追加分も監視 */
function mountArchiveObserver(
    platform: Platform,
    container: Element,
    state: FilterState,
    onFiltered: () => void,
    onBan: (authorId: string) => void,
): void {
  // ① 既存コメントを全件スキャン
  function scanAll(): void {
    for (const node of Array.from(container.children)) {
      if (!(node instanceof Element)) continue;
      const result = processElement(node, platform, state, onBan);
      if (result.removed) onFiltered();
    }
  }

  // ページ読み込み直後は描画が終わっていないので少し待つ
  setTimeout(scanAll, 500);

  // ② スクロールで追加読み込みされるコメントも監視
  observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        // アーカイブも描画待ちが必要
        setTimeout(() => {
          const result = processElement(node, platform, state, onBan);
          if (result.removed) onFiltered();
        }, 100);
      }
    }
  });

  observer.observe(container, { childList: true, subtree: false });
}
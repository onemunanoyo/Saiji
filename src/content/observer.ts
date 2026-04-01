import type { Platform } from '../shared/types';
import { getChatContainer } from '../shared/selectors';
import type { FilterState } from '../shared/types';
import { processElement } from './filter';

const RETRY_INTERVAL_MS = 1000;
const RETRY_MAX         = 20;

let observer: MutationObserver | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function mountObserver(
    platform: Platform,
    state: FilterState,
    onFiltered: () => void,
    onBan: (authorId: string) => void,
): void {
  // 既存 Observer を確実に停止
  dismountObserver();

  attemptMount(platform, state, onFiltered, onBan, 0);
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
        () => attemptMount(platform, state, onFiltered, onBan, attempt + 1),
        RETRY_INTERVAL_MS,
    );
    return;
  }

  observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        const result = processElement(node, platform, state, onBan);
        if (result.removed) onFiltered();
      }
    }
  });

  observer.observe(container, { childList: true, subtree: false });
  console.info(`[Saiji] Observer マウント完了 (${platform})`);
}
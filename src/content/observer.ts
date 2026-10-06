import type { Platform, WatchMode } from '../shared/types';
import { getChatContainer, getNormalCommentContainer } from '../shared/selectors';
import type { FilterState } from '../shared/types';
import { processElement as filterElement } from './filter';
import { checkToxic, invalidateToxic } from './toxic';

const RETRY_INTERVAL_MS = 1000;
const RETRY_MAX         = 20;

// YouTube の非同期描画を待つ遅延（ms）
const PROCESS_DELAY: Record<Platform, number> = {
  youtube: 200,
  twitch:  0,
};

let observer: MutationObserver | null = null;
let mountGeneration = 0;
const removed = new WeakMap<Element, string>();

function processElement(el: Element, platform: Platform, state: FilterState, onBan: (id: string) => void) {
  const target = el.tagName.toLowerCase() === 'ytd-comment-thread-renderer'
      ? el.querySelector('ytd-comment-renderer') ?? el : el;
  const snapshot = target.textContent ?? '';
  if (removed.get(target) === snapshot) return { removed: false };
  const result = filterElement(target, platform, state, onBan);
  if (result.removed) removed.set(target, snapshot);
  return result;
}

function scheduleProcess(callback: () => void, delay: number): void {
  const current = mountGeneration;
  setTimeout(() => { if (current === mountGeneration) callback(); }, delay);
}
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
  mountGeneration++;
  invalidateToxic();
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
  if (!state.filterEnabled) return;
  const container = mode === 'normal' ? getNormalCommentContainer() : getChatContainer(platform);

  if (!container) {
    if (attempt >= RETRY_MAX) {
      console.warn(`[Saiji] コメント欄/チャット欄が見つかりませんでした (${platform} / ${mode})`);
      return;
    }
    retryTimer = setTimeout(
        () => attemptMount(platform, mode, state, onFiltered, onBan, attempt + 1),
        RETRY_INTERVAL_MS,
    );
    return;
  }

  if (mode === 'normal') {
    mountNormalObserver(platform, container, state, onFiltered, onBan);
  } else if (mode === 'archive') {
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
          // 描画完了後に判定（AI は非同期）
          scheduleProcess(() => {
            const result = processElement(node, platform, state, onBan);
            if (result.removed) onFiltered();
            else checkToxic(node, platform, state, onFiltered);
          }, delay);
        } else {
          const result = processElement(node, platform, state, onBan);
          if (result.removed) onFiltered();
          else checkToxic(node, platform, state, onFiltered);
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
      else checkToxic(node, platform, state, onFiltered);
    }
  }

  // ページ読み込み直後は描画が終わっていないので少し待つ
  scheduleProcess(scanAll, 500);

  // ② スクロールで追加読み込みされるコメントも監視
  observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        // アーカイブも描画待ちが必要
        scheduleProcess(() => {
          const result = processElement(node, platform, state, onBan);
          if (result.removed) onFiltered();
          else checkToxic(node, platform, state, onFiltered);
        }, 100);
      }
    }
  });

  observer.observe(container, { childList: true, subtree: false });
}

/** 通常動画用：既存コメントのフィルタリング＋追加コメントの監視 */
function mountNormalObserver(
    platform: Platform,
    container: Element,
    state: FilterState,
    onFiltered: () => void,
    onBan: (authorId: string) => void,
): void {
  // ① 既存コメントをフィルタリング
  function scanExisting(): void {
    const threads = container.querySelectorAll('ytd-comment-thread-renderer');
    threads.forEach(thread => {
      const res = processElement(thread, platform, state, onBan);
      if (res.removed) onFiltered();
      else checkToxic(thread, platform, state, onFiltered);
    });

    const comments = container.querySelectorAll('ytd-comment-renderer');
    comments.forEach(comment => {
      const res = processElement(comment, platform, state, onBan);
      if (res.removed) onFiltered();
      else checkToxic(comment, platform, state, onFiltered);
    });
  }

  scheduleProcess(scanExisting, 500);

  // ② 新規追加されるコメントを監視
  observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        
        const tagName = node.tagName.toLowerCase();
        if (tagName === 'ytd-comment-thread-renderer' || tagName === 'ytd-comment-renderer') {
          scheduleProcess(() => {
            const result = processElement(node, platform, state, onBan);
            if (result.removed) onFiltered();
            else checkToxic(node, platform, state, onFiltered);
          }, 100);
        } else {
          const nestedThreads = node.querySelectorAll('ytd-comment-thread-renderer');
          nestedThreads.forEach(thread => {
            scheduleProcess(() => {
              const result = processElement(thread, platform, state, onBan);
              if (result.removed) onFiltered();
              else checkToxic(thread, platform, state, onFiltered);
            }, 100);
          });
          const nestedComments = node.querySelectorAll('ytd-comment-renderer');
          nestedComments.forEach(comment => {
            scheduleProcess(() => {
              const result = processElement(comment, platform, state, onBan);
              if (result.removed) onFiltered();
              else checkToxic(comment, platform, state, onFiltered);
            }, 100);
          });
        }
      }
    }
  });

  observer.observe(container, { childList: true, subtree: true });
}

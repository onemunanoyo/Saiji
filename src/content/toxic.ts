import { getAuthorId, getMessageText } from '../shared/selectors';
import { matchingLabels, parseScores } from '../shared/toxic';
import type { ToxicResponse } from '../shared/toxic';
import type { FilterState, Message, Platform } from '../shared/types';

let generation = 0;
let seen = new WeakMap<Element, string>();
const hidden = new Map<HTMLElement, { value: string; priority: string }>();

export function invalidateToxic(): void {
  generation++;
  seen = new WeakMap();
  // AI が隠したコメントは設定変更・停止時に元に戻す。
  for (const [el, display] of hidden) {
    if (el.dataset.saijiToxic) {
      el.style.setProperty('display', display.value, display.priority);
      delete el.dataset.saijiToxic;
    }
  }
  hidden.clear();
}

// Include hidden parent threads: their child comments can still have display="".
function isHidden(node: HTMLElement): boolean {
  for (let current: HTMLElement | null = node; current; current = current.parentElement) {
    if (current.hidden || current.style.getPropertyValue('display') === 'none') return true;
  }
  return false;
}

export function checkToxic(el: Element, platform: Platform, state: FilterState, onFiltered: () => void): void {
  if (!state.filterEnabled || !state.toxicSettings.enabled) return;
  // 通常コメントの親スレッドと子コメントを二重判定しない。
  const target = el.tagName.toLowerCase() === 'ytd-comment-thread-renderer'
      ? el.querySelector('ytd-comment-renderer') ?? el : el;
  const text = getMessageText(target, platform);
  const author = getAuthorId(target, platform);
  const snapshot = JSON.stringify([text, author]);
  const node = target as HTMLElement;
  const previous = hidden.get(node);
  if (previous && node.dataset.saijiToxic && seen.get(target) !== snapshot) {
    node.style.setProperty('display', previous.value, previous.priority);
    delete node.dataset.saijiToxic;
    hidden.delete(node);
  }
  if (isHidden(node)) return;
  if (!text || text.length > 2000 || seen.get(target) === snapshot) return;
  seen.set(target, snapshot);
  const current = generation;
  void chrome.runtime.sendMessage({ type: 'JUDGE_TOXIC', text } satisfies Message)
      .then((response: ToxicResponse) => {
        if (current !== generation || !state.filterEnabled || !state.toxicSettings.enabled ||
            !target.isConnected || text !== getMessageText(target, platform) ||
            author !== getAuthorId(target, platform)) return;
        if (!response?.ok) { if (seen.get(target) === snapshot) seen.delete(target); return; }
        const scores = parseScores(response.scores);
        if (!scores) return;
        const labels = matchingLabels(scores, state.toxicSettings);
        if (!labels.length) return;
        if (isHidden(node)) return;
        for (const old of hidden.keys()) if (!old.isConnected) hidden.delete(old);
        hidden.set(node, { value: node.style.getPropertyValue('display'), priority: node.style.getPropertyPriority('display') });
        node.dataset.saijiToxic = labels.join(',');
        node.style.setProperty('display', 'none', 'important');
        onFiltered();
      }).catch(() => { if (seen.get(target) === snapshot) seen.delete(target); });
}

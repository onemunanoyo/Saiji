import type { FilterResult, FilterState, Platform } from '../shared/types';
import { getAuthorId, getMessageText } from '../shared/selectors';

const VIOLATION_THRESHOLD = 3;

/**
 * コメント要素を判定し、必要であれば DOM から削除する
 */
export function processElement(
    el: Element,
    platform: Platform,
    state: FilterState,
    onBan: (authorId: string) => void,
): FilterResult {
  if (!state.filterEnabled) {
    return { removed: false, reason: null, authorId: null };
  }

  const authorId = getAuthorId(el, platform);
  const text     = getMessageText(el, platform);

  // ── ① BL 済みユーザーは即削除 ────────────────────────
  if (authorId && state.bannedUsers.has(authorId)) {
    el.remove();
    return { removed: true, reason: 'blacklisted', authorId };
  }

  // ── ② NGワード判定 ───────────────────────────────────
  const matched = state.ngWords.some(word => text.includes(word));
  if (!matched) {
    return { removed: false, reason: null, authorId };
  }

  // 違反コメントを非表示
  el.remove();

  // ── ③ 違反カウント更新 ───────────────────────────────
  if (authorId) {
    const count = (state.violationCounter.get(authorId) ?? 0) + 1;
    state.violationCounter.set(authorId, count);

    if (count >= VIOLATION_THRESHOLD) {
      state.bannedUsers.add(authorId);
      state.violationCounter.delete(authorId);
      onBan(authorId);
    }
  }

  return { removed: true, reason: 'ng_word', authorId };
}
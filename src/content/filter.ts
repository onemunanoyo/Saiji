import type { FilterResult, FilterState, Platform } from '../shared/types';
import { getAuthorId, getMessageText } from '../shared/selectors';

const VIOLATION_THRESHOLD = 3;

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

  // ① BL 済みユーザーは即削除
  if (authorId && state.bannedUsers.has(authorId)) {
    el.remove();
    return { removed: true, reason: 'blacklisted', authorId };
  }

  // ② NGワード判定（platform フィルタあり）
  const matched = state.ngWords.some(ng => {
    // platform が 'both' または現在のプラットフォームと一致するワードのみ判定
    if (ng.platform !== 'both' && ng.platform !== platform) return false;
    return text.toLowerCase().includes(ng.word.toLowerCase());
  });

  if (!matched) {
    return { removed: false, reason: null, authorId };
  }

  el.remove();

  // ③ 違反カウント更新
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
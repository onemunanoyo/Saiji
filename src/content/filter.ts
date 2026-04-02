import type { FilterResult, FilterState, Platform } from '../shared/types';
import { getAuthorId, getMessageText } from '../shared/selectors';

const VIOLATION_THRESHOLD = 3;

/** 全角英数字を半角に変換 + 小文字化 */
function normalize(str: string): string {
  return str
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .toLowerCase();
}

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

  // ② NGワード判定（platform フィルタ + 正規化）
  const normalizedText = normalize(text);
  const matched = state.ngWords.some(ng => {
    if (ng.platform !== 'both' && ng.platform !== platform) return false;
    return normalizedText.includes(normalize(ng.word));
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
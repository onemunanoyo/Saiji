// ── Storage ───────────────────────────────────────────────
export interface StorageSchema {
  /** 登録済み NGワード一覧 */
  ngWords: string[];
  /** BAN された author-id の配列 */
  bannedIds: string[];
  /** フィルタリング全体の ON/OFF */
  filterEnabled: boolean;
  /** ブラックリスト最終リセット日時 (Unix ms) */
  blUpdatedAt: number;
  /** セッション中の非表示件数 (popup 表示用) */
  sessionFiltered: number;
}

export type StorageKey = keyof StorageSchema;

// ── Messages ──────────────────────────────────────────────
export type Message =
    | { type: 'REMOUNT_OBSERVER' }
    | { type: 'ADD_TO_BLACKLIST'; authorId: string }
    | { type: 'SYNC_BLACKLIST';   bannedIds: string[] }
    | { type: 'SYNC_NG_WORDS';   ngWords: string[] }
    | { type: 'RESET_COUNTER' }
    | { type: 'CLEAR_BLACKLIST' }
    | { type: 'GET_STATS' }
    | { type: 'TOGGLE_FILTER';   enabled: boolean };

export interface StatsResponse {
  filtered: number;
  banned:   number;
}

// ── Alarm names ───────────────────────────────────────────
export const ALARM_RESET_COUNTER   = 'ALARM_RESET_COUNTER'   as const;
export const ALARM_CLEAR_BLACKLIST = 'ALARM_CLEAR_BLACKLIST' as const;

// ── Platform ──────────────────────────────────────────────
export type Platform = 'youtube' | 'twitch';

// ── Filter result ─────────────────────────────────────────
export type FilterReason = 'ng_word' | 'blacklisted';

export interface FilterResult {
  removed:  boolean;
  reason:   FilterReason | null;
  authorId: string | null;
}

// ── FilterState（content_script のメモリ状態）────────────
export interface FilterState {
  ngWords:          string[];
  bannedUsers:      Set<string>;
  violationCounter: Map<string, number>;
  filterEnabled:    boolean;
}
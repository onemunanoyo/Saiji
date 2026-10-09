import { useEffect, useState } from 'react';
import type { Message, StatsResponse } from '../shared/types';
import { getStorage, setStorage } from '../shared/storage';
import { t } from '../shared/i18n';

export default function Popup() {
  const [enabled,     setEnabled]     = useState(true);
  const [commentLock, setCommentLock] = useState(false);
  const [stats,       setStats]       = useState<StatsResponse>({ filtered: 0, banned: 0 });
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      const [en, lock] = await Promise.all([
        getStorage('filterEnabled'),
        getStorage('commentLockEnabled'),
      ]);
      setEnabled(en);
      setCommentLock(lock);
      chrome.runtime.sendMessage({ type: 'GET_STATS' } satisfies Message, (res: StatsResponse) => {
        if (res) setStats(res);
      });
      setLoading(false);
    }
    load();
  }, []);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    await setStorage('filterEnabled', next);
    const msg: Message = { type: 'TOGGLE_FILTER', enabled: next };
    chrome.runtime.sendMessage(msg);
  }

  async function toggleCommentLock() {
    const next = !commentLock;
    setCommentLock(next);
    await setStorage('commentLockEnabled', next);
    const msg: Message = { type: 'TOGGLE_COMMENT_LOCK', enabled: next };
    chrome.runtime.sendMessage(msg);
  }

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  if (loading) {
    return <div style={s.wrap}><p style={s.muted}>{t('loading')}</p></div>;
  }

  return (
    <div style={s.wrap}>
      {/* ヘッダー */}
      <div style={s.header}>
        <span style={s.title}>{t('ext_name')}</span>
        <span style={{ ...s.badge, background: enabled ? '#4F46E5' : '#9CA3AF' }}>
          {enabled ? t('badge_on') : t('badge_off')}
        </span>
      </div>

      {/* 統計 */}
      <div style={s.stats}>
        <Stat label={t('stat_hidden_label')} value={stats.filtered} unit={t('stat_hidden_unit')} />
        <Stat label={t('stat_banned_label')} value={stats.banned}   unit={t('stat_banned_unit')} />
      </div>

      {/* ON/OFF トグル */}
      <button style={{ ...s.btn, background: enabled ? '#EF4444' : '#4F46E5' }} onClick={toggle}>
        {enabled ? t('filter_turn_off') : t('filter_turn_on')}
      </button>

      {/* コメントロック */}
      <button
        style={{ ...s.btn, background: commentLock ? '#F59E0B' : '#E5E7EB', color: commentLock ? '#fff' : '#374151' }}
        onClick={toggleCommentLock}
      >
        {commentLock ? t('comment_lock_turn_off') : t('comment_lock_turn_on')}
      </button>

      {/* 設定へ */}
      <button style={{ ...s.btn, background: '#F3F4F6', color: '#374151' }} onClick={openOptions}>
        {t('open_settings')}
      </button>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div style={s.statBox}>
      <span style={s.statNum}>{value}</span>
      <span style={s.statUnit}>{unit}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

// ── インラインスタイル（最小限） ──────────────────────────
const s: Record<string, React.CSSProperties> = {
  wrap:      { padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 },
  header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:     { fontSize: 16, fontWeight: 700, color: '#1E1B4B' },
  badge:     { fontSize: 11, fontWeight: 700, color: '#fff', padding: '2px 8px', borderRadius: 99 },
  stats:     { display: 'flex', gap: 12, justifyContent: 'center', padding: '12px 0',
               borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' },
  statBox:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 72 },
  statNum:   { fontSize: 28, fontWeight: 700, color: '#1E1B4B', lineHeight: 1 },
  statUnit:  { fontSize: 11, color: '#6B7280' },
  statLabel: { fontSize: 11, color: '#6B7280' },
  btn:       { width: '100%', padding: '9px 0', border: 'none', borderRadius: 8,
               fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  muted:     { color: '#9CA3AF', fontSize: 13, textAlign: 'center' },
};

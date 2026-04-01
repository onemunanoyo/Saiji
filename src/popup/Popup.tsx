import { useEffect, useState } from 'react';
import type { Message, StatsResponse } from '../shared/types';
import { getStorage, setStorage } from '../shared/storage';

export default function Popup() {
  const [enabled,  setEnabled]  = useState(true);
  const [stats,    setStats]    = useState<StatsResponse>({ filtered: 0, banned: 0 });
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const en = await getStorage('filterEnabled');
      setEnabled(en);
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

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  if (loading) {
    return <div style={s.wrap}><p style={s.muted}>読み込み中...</p></div>;
  }

  return (
    <div style={s.wrap}>
      {/* ヘッダー */}
      <div style={s.header}>
        <span style={s.title}>塞耳 Saiji</span>
        <span style={{ ...s.badge, background: enabled ? '#4F46E5' : '#9CA3AF' }}>
          {enabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* 統計 */}
      <div style={s.stats}>
        <Stat label="非表示" value={stats.filtered} unit="件" />
        <Stat label="追放"   value={stats.banned}   unit="人" />
      </div>

      {/* ON/OFF トグル */}
      <button style={{ ...s.btn, background: enabled ? '#EF4444' : '#4F46E5' }} onClick={toggle}>
        フィルタを{enabled ? 'OFF にする' : 'ON にする'}
      </button>

      {/* 設定へ */}
      <button style={{ ...s.btn, background: '#F3F4F6', color: '#374151', marginTop: 6 }} onClick={openOptions}>
        設定・NGワード管理
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

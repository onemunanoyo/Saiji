import { useEffect, useRef, useState } from 'react';
import type { NgWord, NgWordPlatform } from '../shared/types';
import { getStorage, addNgWord, removeNgWord, removeBannedId } from '../shared/storage';

type Tab = 'ngwords' | 'blacklist';

function normalize(str: string): string {
  return str
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .toLowerCase();
}

// プラットフォームトグル: both → youtube → twitch → both
const PLATFORM_CYCLE: NgWordPlatform[] = ['both', 'youtube', 'twitch'];

const PLATFORM_LABEL: Record<NgWordPlatform, string> = {
  both:    'Y  T',
  youtube: 'Y',
  twitch:  'T',
};

const PLATFORM_STYLE: Record<NgWordPlatform, React.CSSProperties> = {
  both:    { background: '#E5E7EB', color: '#374151' },
  youtube: { background: '#DC2626', color: '#fff' },
  twitch:  { background: '#7C3AED', color: '#fff' },
};

export default function Options() {
  const [tab,       setTab]       = useState<Tab>('ngwords');
  const [ngWords,   setNgWords]   = useState<NgWord[]>([]);
  const [bannedIds, setBannedIds] = useState<string[]>([]);
  const [input,     setInput]     = useState('');
  const [platform,  setPlatform]  = useState<NgWordPlatform>('both');
  const [error,     setError]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [ng, bl] = await Promise.all([
      getStorage('ngWords'),
      getStorage('bannedIds'),
    ]);
    setNgWords(ng);
    setBannedIds(bl);
  }

  function cyclePlatform() {
    const idx = PLATFORM_CYCLE.indexOf(platform);
    setPlatform(PLATFORM_CYCLE[(idx + 1) % PLATFORM_CYCLE.length]);
  }

  async function handleAdd() {
    const word = input.trim();
    if (!word) { setError('ワードを入力してください'); return; }
    if (ngWords.some(w => normalize(w.word) === normalize(word) && w.platform === platform)) {
      setError('同じワード・同じ対象がすでに登録されています（表記違いを含む）'); return;
    }
    await addNgWord({ word, platform });
    setInput('');
    setError('');
    await loadAll();
    inputRef.current?.focus();
  }

  async function handleRemoveNg(word: string, plt: NgWordPlatform) {
    await removeNgWord(word, plt);
    await loadAll();
  }

  async function handleRemoveBan(id: string) {
    await removeBannedId(id);
    await loadAll();
  }

  return (
      <div style={s.page}>
        <div style={s.card}>

          <div style={s.header}>
            <h1 style={s.title}>塞耳 Saiji — 設定</h1>
          </div>

          <div style={s.tabs}>
            {(['ngwords', 'blacklist'] as Tab[]).map(t => (
                <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
                  {t === 'ngwords' ? `NGワード (${ngWords.length})` : `追放リスト (${bannedIds.length})`}
                </button>
            ))}
          </div>

          {tab === 'ngwords' && (
              <div style={s.body}>

                {/* 入力行 */}
                <div style={s.inputRow}>
                  {/* プラットフォームトグル */}
                  <button
                      style={{ ...s.platformBtn, ...PLATFORM_STYLE[platform] }}
                      onClick={cyclePlatform}
                      title="対象プラットフォームを切り替え"
                  >
                    {PLATFORM_LABEL[platform]}
                  </button>
                  <input
                      ref={inputRef}
                      style={s.input}
                      value={input}
                      onChange={e => { setInput(e.target.value); setError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleAdd()}
                      placeholder="NGワードを入力（Enter で追加）"
                  />
                  <button style={s.addBtn} onClick={handleAdd}>追加</button>
                </div>

                {/* トグルの説明 */}
                <p style={s.hint}>
                  {platform === 'both'    && '両方のプラットフォームに適用されます'}
                  {platform === 'youtube' && 'YouTube のみに適用されます'}
                  {platform === 'twitch'  && 'Twitch のみに適用されます'}
                </p>

                {error && <p style={s.error}>{error}</p>}

                {ngWords.length === 0
                    ? <p style={s.empty}>NGワードが登録されていません</p>
                    : <ul style={s.list}>
                      {ngWords.map((ng, i) => (
                          <li key={i} style={s.item}>
                            {/* プラットフォームバッジ */}
                            <span style={{ ...s.badge, ...PLATFORM_STYLE[ng.platform] }}>
                        {PLATFORM_LABEL[ng.platform]}
                      </span>
                            <span style={s.wordText}>{ng.word}</span>
                            <button style={s.delBtn} onClick={() => handleRemoveNg(ng.word, ng.platform)}>削除</button>
                          </li>
                      ))}
                    </ul>
                }
              </div>
          )}

          {tab === 'blacklist' && (
              <div style={s.body}>
                {bannedIds.length === 0
                    ? <p style={s.empty}>追放されたユーザーはいません</p>
                    : <ul style={s.list}>
                      {bannedIds.map(id => (
                          <li key={id} style={s.item}>
                            <span style={{ ...s.wordText, fontFamily: 'monospace', fontSize: 12 }}>{id}</span>
                            <button
                                style={{ ...s.delBtn, background: '#F0FDF4', color: '#16A34A' }}
                                onClick={() => handleRemoveBan(id)}
                            >
                              解除
                            </button>
                          </li>
                      ))}
                    </ul>
                }
              </div>
          )}

        </div>
      </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:        { minHeight: '100vh', background: '#F9FAFB', display: 'flex', justifyContent: 'center', padding: '32px 16px' },
  card:        { width: '100%', maxWidth: 560, background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' },
  header:      { padding: '20px 24px 16px', borderBottom: '1px solid #E5E7EB' },
  title:       { fontSize: 20, fontWeight: 700, color: '#1E1B4B', margin: 0 },
  tabs:        { display: 'flex', borderBottom: '1px solid #E5E7EB' },
  tab:         { flex: 1, padding: '12px 0', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
    borderBottom: '2px solid transparent', background: 'none',
    fontSize: 14, color: '#6B7280', cursor: 'pointer', fontWeight: 500 },
  tabActive:   { color: '#4F46E5', borderBottom: '2px solid #4F46E5', fontWeight: 700 },
  body:        { padding: '20px 24px' },
  inputRow:    { display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' },
  platformBtn: { padding: '0 10px', height: 38, minWidth: 44, border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: 1, flexShrink: 0 },
  input:       { flex: 1, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, outline: 'none' },
  addBtn:      { padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  hint:        { fontSize: 11, color: '#9CA3AF', marginBottom: 8 },
  error:       { color: '#DC2626', fontSize: 12, marginBottom: 8 },
  empty:       { color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: '24px 0' },
  list:        { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  item:        { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
    background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' },
  badge:       { fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0, letterSpacing: 1 },
  wordText:    { fontSize: 14, color: '#374151', flex: 1 },
  delBtn:      { padding: '4px 12px', background: '#FEF2F2', color: '#DC2626', border: 'none',
    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
};
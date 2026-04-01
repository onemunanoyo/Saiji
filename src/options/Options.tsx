import { useEffect, useRef, useState } from 'react';
import { getStorage, addNgWord, removeNgWord, removeBannedId } from '../shared/storage';

type Tab = 'ngwords' | 'blacklist';

export default function Options() {
  const [tab,       setTab]       = useState<Tab>('ngwords');
  const [ngWords,   setNgWords]   = useState<string[]>([]);
  const [bannedIds, setBannedIds] = useState<string[]>([]);
  const [input,     setInput]     = useState('');
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

  async function handleAdd() {
    const word = input.trim();
    if (!word) { setError('ワードを入力してください'); return; }
    if (ngWords.includes(word)) { setError('すでに登録されています'); return; }
    await addNgWord(word);
    setInput('');
    setError('');
    await loadAll();
    inputRef.current?.focus();
  }

  async function handleRemoveNg(word: string) {
    await removeNgWord(word);
    await loadAll();
  }

  async function handleRemoveBan(id: string) {
    await removeBannedId(id);
    await loadAll();
  }

  return (
      <div style={s.page}>
        <div style={s.card}>

          {/* ヘッダー */}
          <div style={s.header}>
            <h1 style={s.title}>塞耳 Saiji — 設定</h1>
          </div>

          {/* タブ */}
          <div style={s.tabs}>
            {(['ngwords', 'blacklist'] as Tab[]).map(t => (
                <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
                  {t === 'ngwords' ? `NGワード (${ngWords.length})` : `追放リスト (${bannedIds.length})`}
                </button>
            ))}
          </div>

          {/* NGワードタブ */}
          {tab === 'ngwords' && (
              <div style={s.body}>
                <div style={s.inputRow}>
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
                {error && <p style={s.error}>{error}</p>}

                {ngWords.length === 0
                    ? <p style={s.empty}>NGワードが登録されていません</p>
                    : <ul style={s.list}>
                      {ngWords.map(word => (
                          <li key={word} style={s.item}>
                            <span style={s.wordText}>{word}</span>
                            <button style={s.delBtn} onClick={() => handleRemoveNg(word)}>削除</button>
                          </li>
                      ))}
                    </ul>
                }
              </div>
          )}

          {/* 追放リストタブ */}
          {tab === 'blacklist' && (
              <div style={s.body}>
                {bannedIds.length === 0
                    ? <p style={s.empty}>追放されたユーザーはいません</p>
                    : <ul style={s.list}>
                      {bannedIds.map(id => (
                          <li key={id} style={s.item}>
                            <span style={{ ...s.wordText, fontFamily: 'monospace', fontSize: 12 }}>{id}</span>
                            <button style={{ ...s.delBtn, background: '#F0FDF4', color: '#16A34A' }}
                                    onClick={() => handleRemoveBan(id)}>解除</button>
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
  page:      { minHeight: '100vh', background: '#F9FAFB', display: 'flex', justifyContent: 'center', padding: '32px 16px' },
  card:      { width: '100%', maxWidth: 560, background: '#fff', borderRadius: 12,
    border: '1px solid #E5E7EB', overflow: 'hidden' },
  header:    { padding: '20px 24px 0', borderBottom: '1px solid #E5E7EB', paddingBottom: 16 },
  title:     { fontSize: 20, fontWeight: 700, color: '#1E1B4B', margin: 0 },
  tabs:      { display: 'flex', borderBottom: '1px solid #E5E7EB' },
  tab:       { flex: 1, padding: '12px 0', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '2px solid transparent', background: 'none',
    fontSize: 14, color: '#6B7280', cursor: 'pointer', fontWeight: 500 },
  tabActive: { color: '#4F46E5', borderBottom: '2px solid #4F46E5', fontWeight: 700 },
  body:      { padding: '20px 24px' },
  inputRow:  { display: 'flex', gap: 8, marginBottom: 8 },
  input:     { flex: 1, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: 8,
    fontSize: 14, outline: 'none' },
  addBtn:    { padding: '8px 16px', background: '#4F46E5', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  error:     { color: '#DC2626', fontSize: 12, marginBottom: 8 },
  empty:     { color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: '24px 0' },
  list:      { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  item:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', background: '#F9FAFB', borderRadius: 8,
    border: '1px solid #E5E7EB' },
  wordText:  { fontSize: 14, color: '#374151', flex: 1 },
  delBtn:    { padding: '4px 12px', background: '#FEF2F2', color: '#DC2626', border: 'none',
    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};
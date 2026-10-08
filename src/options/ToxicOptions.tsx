import { useEffect, useState } from 'react';
import { getStorage, setStorage } from '../shared/storage';
import { t } from '../shared/i18n';
import { DEFAULT_TOXIC_SETTINGS, README_THRESHOLDS, TOXIC_LABELS, TOXIC_PERMISSION } from '../shared/toxic';
import type { ToxicLabel, ToxicResponse, ToxicSettings } from '../shared/toxic';
import type { Message } from '../shared/types';

export default function ToxicOptions() {
  const [settings, setSettings] = useState<ToxicSettings>(structuredClone(DEFAULT_TOXIC_SETTINGS));
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState<ToxicResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getStorage('toxicSettings').then(value => { setSettings(value); setLoaded(true); });
  }, []);

  function setThreshold(label: ToxicLabel, value: number | undefined) {
    const thresholds = { ...settings.thresholds };
    if (value === undefined) delete thresholds[label];
    else thresholds[label] = value;
    setSettings({ ...settings, thresholds });
    setStatus('');
  }

  async function save() {
    setBusy(true);
    try {
      if (settings.enabled && !await chrome.permissions.request({ origins: [TOXIC_PERMISSION] })) {
        setStatus(t('ai_permission_denied'));
        return;
      }
      await setStorage('toxicSettings', settings);
      setStatus(t('ai_saved'));
    } catch {
      setStatus(t('ai_unavailable'));
    } finally { setBusy(false); }
  }

  async function health() {
    setBusy(true);
    try {
      if (!await chrome.permissions.request({ origins: [TOXIC_PERMISSION] })) {
        setStatus(t('ai_permission_denied'));
        return;
      }
      const response = await chrome.runtime.sendMessage({ type: 'TOXIC_HEALTH' } satisfies Message);
      setStatus(t(response?.ok ? 'ai_ready' : 'ai_unavailable'));
    } catch { setStatus(t('ai_unavailable')); }
    finally { setBusy(false); }
  }

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await chrome.runtime.sendMessage({ type: 'JUDGE_TOXIC', text } satisfies Message));
    } catch { setResult({ ok: false, error: 'unavailable' }); }
    finally { setBusy(false); }
  }

  if (!loaded) return <p>{t('loading')}</p>;
  return <section>
    <p style={{ fontSize: 13, lineHeight: 1.7 }}>{t('ai_description')}</p>
    <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.7 }}>{t('ai_caveat')}</p>
    <label><input type="checkbox" checked={settings.enabled}
        onChange={e => { setSettings({ ...settings, enabled: e.target.checked }); setStatus(''); }} /> {t('ai_enable')}</label>
    <p style={{ fontSize: 12 }}>{t('ai_threshold_hint')}</p>
    <p>Saiji-Toxic-v2 / 本文のみ・最大128トークン</p>
    <button onClick={() => { setSettings({ ...settings, thresholds: structuredClone(DEFAULT_TOXIC_SETTINGS.thresholds) }); setStatus(''); }}>1,000件ベンチの設定</button>
    <button onClick={() => { setSettings({ ...settings, thresholds: { ...README_THRESHOLDS } }); setStatus(''); }}>理由別の設定</button>
    <p style={{ fontSize: 12 }}>ベンチ設定は先頭5ラベルの最大値 ≥ 0.005039215で非表示。実験用の閾値で、見逃しが残ります。変更後は保存してください。</p>
    {TOXIC_LABELS.map(label => <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
      <label style={{ flex: 1 }}><input type="checkbox" checked={settings.thresholds[label] !== undefined}
          onChange={e => setThreshold(label, e.target.checked ? DEFAULT_TOXIC_SETTINGS.thresholds[label] ?? 0.7 : undefined)} /> {t(`ai_label_${label}`)}</label>
      <input aria-label={`${t(`ai_label_${label}`)} ${t('ai_threshold')}`} type="number" min="0.000001" max="1" step="any"
          disabled={settings.thresholds[label] === undefined} value={settings.thresholds[label] ?? 0.7}
          onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0 && n <= 1) setThreshold(label, n); }} style={{ width: 65 }} />
    </div>)}
    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
      <button disabled={busy} onClick={() => void save()}>{t('ai_save')}</button>
      <button disabled={busy} onClick={() => void health()}>{t('ai_check')}</button>
    </div>
    <p role="status">{status}</p>
    <hr />
    <p style={{ fontSize: 12 }}>{t('ai_test_hint')}</p>
    <textarea aria-label={t('ai_test_input')} value={text} maxLength={2000} rows={3}
        style={{ width: '100%', boxSizing: 'border-box' }} onChange={e => setText(e.target.value)} />
    <button disabled={busy || !text.trim()} onClick={() => void test()}>{t('ai_test')}</button>
    {result && (result.ok ? <ul>{TOXIC_LABELS.map(label => <li key={label}>
      {t(`ai_label_${label}`)}: {(result.scores[label] * 100).toFixed(1)}%
    </li>)}</ul> : <p role="alert">{t(result.error === 'disabled' ? 'ai_test_disabled' : 'ai_unavailable')}</p>)}
  </section>;
}

import { getStorage } from '../shared/storage';
import { parseScores, TOXIC_ORIGIN } from '../shared/toxic';
import type { ToxicResponse } from '../shared/toxic';

let active = 0;
const cache = new Map<string, { response: ToxicResponse; expires: number }>();

export async function judgeToxic(text: string): Promise<ToxicResponse> {
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) return { ok: false, error: 'invalid_text' };
  const settings = await getStorage('toxicSettings');
  if (!settings.enabled) return { ok: false, error: 'disabled' };
  const cached = cache.get(text);
  if (cached && cached.expires > Date.now()) return cached.response;
  // 過負荷時はコメントを表示したままにする。無制限に待ち行列を増やさない。
  if (active >= 4) return { ok: false, error: 'busy' };
  active++;
  try {
    const response = await fetch(`${TOXIC_ORIGIN}/judge`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), signal: AbortSignal.timeout(3000),
      redirect: 'error', credentials: 'omit',
    });
    if (!response.ok) throw new Error('server_error');
    const body = await response.json();
    const scores = parseScores(body.scores);
    if (!scores) throw new Error('invalid_scores');
    const result: ToxicResponse = { ok: true, scores };
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(text, { response: result, expires: Date.now() + 60_000 });
    return result;
  } catch {
    return { ok: false, error: 'unavailable' };
  } finally {
    active--;
  }
}

export async function toxicHealth(): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${TOXIC_ORIGIN}/health`, {
      signal: AbortSignal.timeout(2000), redirect: 'error', credentials: 'omit',
    });
    const body = await res.json();
    return { ok: res.ok && body.ready === true && body.service === 'saiji-toxic' };
  } catch {
    return { ok: false };
  }
}

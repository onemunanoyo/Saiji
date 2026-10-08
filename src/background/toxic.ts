import { getStorage } from '../shared/storage';
import { parseScores } from '../shared/toxic';
import type { ToxicResponse } from '../shared/toxic';

let creating: Promise<void> | null = null;
let active = 0;
const cache = new Map<string, { response: ToxicResponse; expires: number }>();
async function ensureDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) creating = chrome.offscreen.createDocument({
    url: 'offscreen.html', reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'Run the local chat classifier in a shared WebGPU/WASM worker.',
  }).finally(() => { creating = null; });
  await creating;
}
async function request(action: string, text?: string) {
  await ensureDocument();
  const settings = await getStorage('toxicSettings');
  return chrome.runtime.sendMessage({ type: 'BROWSER_INFERENCE', target: 'saiji-inference', action, text, preference: settings.backend ?? 'auto' });
}
export async function judgeToxic(text: string): Promise<ToxicResponse> {
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) return { ok: false, error: 'invalid_text' };
  const settings = await getStorage('toxicSettings');
  if (!settings.enabled) return { ok: false, error: 'disabled' };
  const key = (settings.backend ?? 'auto') + ':' + text;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.response;
  if (active >= 32) return { ok: false, error: 'busy' };
  active++;
  try {
    const body = await request('judge', text);
    const scores = body?.ok && parseScores(body.scores);
    if (!scores) return { ok: false, error: body?.error ?? 'invalid_scores' };
    const result: ToxicResponse = { ok: true, scores };
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(key, { response: result, expires: Date.now() + 60_000 });
    return result;
  } catch { return { ok: false, error: 'unavailable' }; }
  finally { active--; }
}
export async function toxicHealth(): Promise<{ ok: boolean; backend?: string; error?: string }> {
  try { return await request('health'); }
  catch (error) { return { ok: false, error: String(error) }; }
}

import { getStorage } from '../shared/storage';
import { parseScores } from '../shared/toxic';
import type { ToxicResponse } from '../shared/toxic';

let active = 0;
let generation = 0;
let lifecycle: Promise<unknown> = Promise.resolve();
const cache = new Map<string, { response: ToxicResponse; expires: number }>();

export function isToxicTarget(url?: string): boolean {
  try {
    const parsed = new URL(url ?? '');
    return ['https:', 'http:'].includes(parsed.protocol) &&
      ['youtube.com', 'twitch.tv'].some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));
  } catch { return false; }
}
async function needed(): Promise<boolean> {
  const [settings, filterEnabled, tabs] = await Promise.all([
    getStorage('toxicSettings'), getStorage('filterEnabled'), chrome.tabs.query({}),
  ]);
  return settings.enabled && filterEnabled && tabs.some(tab => !tab.discarded && isToxicTarget(tab.url));
}
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = lifecycle.then(operation);
  lifecycle = next.catch(() => {});
  return next;
}
export async function reconcileToxicLifecycle(forceRelease = false): Promise<void> {
  await serialize(async () => {
    if (!forceRelease && await needed()) return;
    generation++;
    cache.clear();
    if (!await chrome.offscreen.hasDocument()) return;
    // Terminate the worker, including an in-flight download or inference, before closing its host.
    await chrome.runtime.sendMessage({ type: 'BROWSER_INFERENCE', target: 'saiji-inference', action: 'dispose' }).catch(() => {});
    await chrome.offscreen.closeDocument();
  });
}
async function request(action: string, text?: string) {
  const prepared = await serialize(async () => {
    if (!await needed()) return null;
    if (!await chrome.offscreen.hasDocument()) await chrome.offscreen.createDocument({
      url: 'offscreen.html', reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Run the local classifier only while filtering YouTube or Twitch tabs.',
    });
    return { settings: await getStorage('toxicSettings'), generation };
  });
  if (!prepared) return { ok: false, error: 'idle' };
  const { settings, generation: started } = prepared;
  const result = await chrome.runtime.sendMessage({ type: 'BROWSER_INFERENCE', target: 'saiji-inference', action, text,
    preference: settings.backend ?? 'auto', downloadMissingModel: settings.downloadMissingModel !== false });
  return started === generation ? result : { ok: false, error: 'released' };
}
export async function judgeToxic(text: string): Promise<ToxicResponse> {
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) return { ok: false, error: 'invalid_text' };
  const settings = await getStorage('toxicSettings');
  if (!settings.enabled) return { ok: false, error: 'disabled' };
  if (!await needed()) return { ok: false, error: 'idle' };
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

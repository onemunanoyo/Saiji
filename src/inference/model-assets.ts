// Immutable, benchmark-verified browser model assets. Runtime code stays bundled.
export const MODEL_REVISION = "3530d6bb0492c4038f61092c7c2db0598747b424";
export const MODEL_FILES: Record<string, string> = {
  "LICENSE": "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
  "model.onnx": "d440815d18d98df455aceeb0df6b0d1848efdd4c31e3cfc2946d366984a9e66f",
  "tokenizer.json": "0dba2fb6b72f6b320157f74979b023a236e1be7f3ad34a0052e4c4b053254882",
  "tokenizer_config.json": "1c117ab9eae314027c48de03faf31f1c84254494854e75f29871c1c72d7a2942"
};
const CACHE_NAME = 'saiji-model-' + MODEL_REVISION;
export function modelUrl(name: string): string {
  if (!(name in MODEL_FILES)) throw Error('Unknown model asset');
  return `https://huggingface.co/j-llm/Saiji-toxic_v2/resolve/${MODEL_REVISION}/browser/${name}`;
}
async function verify(bytes: ArrayBuffer, name: string) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== MODEL_FILES[name]) throw Error(`Model integrity check failed: ${name}`);
}
export async function loadAsset(base: string, name: string, allowDownload: boolean): Promise<ArrayBuffer> {
  // Bundled files remain usable offline, including when downloading is disabled.
  let local: Response | undefined;
  try { local = await fetch(base + 'model/' + name); } catch { /* No bundled model. */ }
  if (local?.ok) {
    const bytes = await local.arrayBuffer();
    await verify(bytes, name);
    return bytes;
  }
  const cache = await caches.open(CACHE_NAME);
  const url = modelUrl(name);
  const saved = await cache.match(url);
  if (saved) {
    const bytes = await saved.arrayBuffer();
    try { await verify(bytes, name); return bytes; }
    catch { await cache.delete(url); }
  }
  if (!allowDownload) throw Error('モデルがありません。設定でHugging Faceからの取得を有効にしてください。');
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(10 * 60_000) });
  if (!response.ok) throw Error(`HF model download failed (${response.status}): ${name}`);
  const bytes = await response.arrayBuffer();
  await verify(bytes, name);
  await cache.put(url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
  return bytes;
}

let worker: Worker | null = null;
let preference = '';
let sequence = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; timer: ReturnType<typeof setTimeout> }>();

function resetWorker(next: string) {
  worker?.terminate();
  for (const item of pending.values()) { clearTimeout(item.timer); item.resolve({ ok: false, error: 'backend_changed' }); }
  pending.clear();
  preference = next;
  worker = new Worker(chrome.runtime.getURL('inference/worker.js'), { type: 'module' });
  worker.onmessage = event => {
    const item = pending.get(event.data.id);
    if (item) { clearTimeout(item.timer); pending.delete(event.data.id); item.resolve(event.data.result); }
  };
  worker.onerror = () => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.resolve({ ok: false, error: 'worker_failed' }); }
    pending.clear(); worker?.terminate(); worker = null;
  };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.target !== 'saiji-inference' || sender.id !== chrome.runtime.id) return false;
  if (pending.size >= 32) { respond({ ok: false, error: 'busy' }); return false; }
  if (!worker || preference !== message.preference) resetWorker(message.preference);
  const id = ++sequence;
  const timer = setTimeout(() => {
    // A hung inference must not leave an unbounded worker queue behind.
    for (const item of pending.values()) { clearTimeout(item.timer); item.resolve({ ok: false, error: 'inference_timeout' }); }
    pending.clear(); worker?.terminate(); worker = null;
  }, 120_000);
  pending.set(id, { resolve: respond, timer });
  worker!.postMessage({ ...message, id, base: chrome.runtime.getURL('') });
  return true;
});

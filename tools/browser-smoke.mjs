import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9227');
const context = browser.contexts()[0];
try {
  const worker = context.serviceWorkers().find(worker => worker.url().endsWith('/background/index.js'));
  const existingPage = context.pages().find(page => page.url().endsWith('/options.html'));
  const id = (worker?.url() ?? existingPage?.url())?.split('/')[2];
  if (!id) throw Error('Open the loaded extension options page first.');
  if (worker) await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
  else if (existingPage) await existingPage.evaluate(() => chrome.runtime.reload()).catch(() => {});
  const page = await context.newPage();
  await new Promise(resolve => setTimeout(resolve, 1000));
  page.on('console', message => console.log('browser:', message.type(), message.text()));
  page.on('pageerror', error => console.log('browser-error:', String(error)));
  await page.goto(`chrome-extension://${id}/options.html`);
  const results = [];
  for (const backend of ['wasm', 'webgpu']) {
    const result = await page.evaluate(async backend => {
      const defaults = (await chrome.storage.local.get('toxicSettings')).toxicSettings;
      await chrome.storage.local.set({ toxicSettings: { ...defaults, enabled: true, backend } });
      const health = await chrome.runtime.sendMessage({ type: 'TOXIC_HEALTH' });
      const judged = [];
      if (health?.ok) for (const text of ['配信ありがとう！楽しかった', 'お前は本当に最低だ。死ね', 'tntn！']) {
        const start = performance.now();
        const result = await chrome.runtime.sendMessage({ type: 'JUDGE_TOXIC', text });
        judged.push({ text, milliseconds: performance.now() - start, result });
      }
      return { backend, health, judged };
    }, backend);
    results.push(result); console.log(JSON.stringify(result));
  }
  await writeFile('logs/browser-smoke.json', JSON.stringify(results, null, 2));
  if (results.some(result => !result.health?.ok || result.judged.length !== 3 || result.judged.some(x => !x.result.ok))) throw Error('Browser inference failed');
} finally { await browser.close(); }

import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const source = process.argv[2];
if (!source) throw Error('Pass the benchmark JSONL path as the first argument.');
const rows = (await readFile(source, 'utf8')).trim().split('\n').map(JSON.parse);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9227');
try {
  const context = browser.contexts()[0];
  const worker = context.serviceWorkers().find(w => w.url().endsWith('/background/index.js'));
  const extensionPage = context.pages().find(p => p.url().endsWith('/options.html'));
  const id = (worker?.url() ?? extensionPage?.url())?.split('/')[2];
  if (!id) throw Error('Open the loaded extension options page first.');
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/options.html`);
  const results = await page.evaluate(async rows => {
    const settings = (await chrome.storage.local.get('toxicSettings')).toxicSettings;
    await chrome.storage.local.set({ toxicSettings: { ...settings, enabled: true, backend: 'webgpu' } });
    const health = await chrome.runtime.sendMessage({ type: 'TOXIC_HEALTH' });
    if (!health?.ok) throw Error(JSON.stringify(health));
    const output = [];
    for (const r of rows) {
      const start = performance.now();
      const result = await chrome.runtime.sendMessage({ type: 'JUDGE_TOXIC', text: r.text });
      if (!result?.ok) throw Error(JSON.stringify(result));
      const score = Math.max(...['toxicity','harassment','obscene','discrimination','threat'].map(k => result.scores[k]));
      output.push({ id: r.sample_id, target: r.target, score, unsafe: score >= 0.005039215087890625, scores: result.scores, milliseconds: performance.now() - start });
    }
    return output;
  }, rows);
  let fp=0,fn=0,tp=0;const flips=[];
  for (let i=0;i<rows.length;i++) {
    const r=results[i],old=rows[i].classifiers['Saiji-1epoch-short'];
    if (r.unsafe && !r.target) fp++; if (!r.unsafe && r.target) fn++; if(r.unsafe && r.target)tp++;
    if (r.unsafe !== (old.calibrated === 'unsafe')) flips.push({ id:r.id, old:old.harm_score, browser:r.score });
  }
  const times=results.slice(1).map(r=>r.milliseconds).sort((a,b)=>a-b);
  const receipt={backend:'webgpu',rows:rows.length,tp,fp,fn,flips,median_ms:times[Math.floor(times.length/2)],p95_ms:times[Math.floor(times.length*.95)]};
  await writeFile('logs/browser-benchmark-scores.json',JSON.stringify(results));
  await writeFile('logs/browser-benchmark-receipt.json',JSON.stringify(receipt,null,2));
  console.log(receipt);
  await page.close();
} finally { await browser.close(); }

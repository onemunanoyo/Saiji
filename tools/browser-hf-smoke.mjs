import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9227');
try {
 const context = browser.contexts()[0];
  await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Saiji isolated test</body></html>' }));
  const targetPage = await context.newPage();
  await targetPage.goto('https://www.youtube.com/watch?v=saiji-isolated-test');

 let worker=context.serviceWorkers().find(w=>w.url().endsWith('/background/index.js'));
 const id=process.argv[2] ?? worker?.url().split('/')[2];
 if (!id) throw Error('Pass the unpacked extension ID as the first argument.'); let page=await context.newPage();
 await page.goto(`chrome-extension://${id}/options.html`);
 const settings={enabled:true,backend:'wasm',downloadMissingModel:true,thresholds:{toxicity:0.005039215087890625}};
 await page.evaluate(settings=>chrome.storage.local.set({toxicSettings:settings}),settings);
 const start=Date.now();
 const downloaded=await page.evaluate(()=>chrome.runtime.sendMessage({type:'TOXIC_HEALTH'}));
 console.log('download',downloaded,'elapsed_ms',Date.now()-start);
 if (!downloaded?.ok) throw Error(JSON.stringify(downloaded));
 const first=await page.evaluate(()=>chrome.runtime.sendMessage({type:'JUDGE_TOXIC',text:'配信ありがとう！楽しかった'}));
 await page.evaluate(settings=>chrome.storage.local.set({toxicSettings:{...settings,backend:'webgpu',downloadMissingModel:false}}),settings);
 await context.setOffline(true);
 const offline=await page.evaluate(()=>chrome.runtime.sendMessage({type:'TOXIC_HEALTH'}));
 const reused=await page.evaluate(()=>chrome.runtime.sendMessage({type:'JUDGE_TOXIC',text:'配信ありがとう！楽しかった'}));
 console.log('offline',offline,'judge',reused?.ok);
 if (!offline?.ok || !first?.ok || !reused?.ok) throw Error('Offline cache test failed');
 await writeFile('logs/hf-download-smoke.json',JSON.stringify({downloaded,first,offline,reused},null,2));
} finally { const session=await browser.newBrowserCDPSession();await session.send('Browser.close').catch(()=>{}); }

import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const b=await chromium.connectOverCDP('http://127.0.0.1:9227');
try {
 const c=b.contexts()[0];const w=c.serviceWorkers().find(w=>w.url().endsWith('/background/index.js'));
 const id=process.argv[2]??w?.url().split('/')[2];if(!id)throw Error('Pass extension ID');
 const errors=[];const page=await c.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.setViewportSize({width:1280,height:800});await page.goto(`chrome-extension://${id}/options.html`);
 console.log('id',id,'language',await page.evaluate(()=>chrome.i18n.getUILanguage()));
 const english=JSON.parse(await readFile('public/_locales/en/messages.json','utf8'));
 await page.getByRole('button',{name:english.tab_ai.message,exact:true}).click();
 await page.getByText(english.ai_experimental.message,{exact:true}).waitFor({state:'visible'});
 await page.screenshot({path:'release/screenshot-en-1280x800.png'});
 for(const locale of ['ja','ko']){
  const strings=JSON.parse(await readFile(`public/_locales/${locale}/messages.json`,'utf8'));
  const localPage=await c.newPage();await localPage.setViewportSize({width:1280,height:800});
  await localPage.addInitScript(({strings,locale})=>{
   chrome.i18n.getMessage=(key,subs=[])=>{let text=strings[key]?.message??'';for(let i=0;i<subs.length;i++)text=text.replaceAll('$'+(i+1),subs[i]);return text;};
   chrome.i18n.getUILanguage=()=>locale;
  },{strings,locale});
  await localPage.goto(`chrome-extension://${id}/options.html`);
  await localPage.getByRole('button',{name:strings.tab_ai.message,exact:true}).click();
  await localPage.getByText(strings.ai_experimental.message,{exact:true}).waitFor({state:'visible'});
  await localPage.screenshot({path:`release/screenshot-${locale}-1280x800.png`});await localPage.close();
 }
 await c.route('https://www.youtube.com/**',r=>r.fulfill({contentType:'text/html',body:'<html><body>Isolated Store test</body></html>'}));
 const target=await c.newPage();await target.goto('https://www.youtube.com/watch?v=saiji-store-test');
 await page.evaluate(()=>chrome.storage.local.set({toxicSettings:{enabled:true,backend:'webgpu',downloadMissingModel:true,thresholds:{toxicity:0.005039215087890625}},filterEnabled:true}));
 const health=await page.evaluate(()=>chrome.runtime.sendMessage({type:'TOXIC_HEALTH'}));console.log('Store health',health);
 if(!health?.ok)throw Error(JSON.stringify(health));
 const result=await page.evaluate(()=>chrome.runtime.sendMessage({type:'JUDGE_TOXIC',text:'配信ありがとう！楽しかった'}));if(!result?.ok)throw Error(JSON.stringify(result));
 await target.close();await page.waitForFunction(async()=>(await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length===0,{},{timeout:15000});
 await writeFile('logs/store-browser-receipt.json',JSON.stringify({health,result,errors,releaseAfterTargetClose:true,localeScreenshots:['en (native)','ja (locale fixture)','ko (locale fixture)']},null,2));
 if(errors.length)throw Error(errors.join('\n'));console.log('Store package smoke passed');
}finally{const s=await b.newBrowserCDPSession();await s.send('Browser.close').catch(()=>{});}

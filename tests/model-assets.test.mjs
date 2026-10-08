import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/inference/model-assets.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const assets=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const originalFetch=globalThis.fetch;
const cache=new Map();
globalThis.caches={open:async()=>({match:async key=>cache.get(key)?.clone(),put:async(key,response)=>cache.set(key,response),delete:async key=>cache.delete(key)})};
test('disabled download never contacts HF; corrupt cache is discarded',async()=>{
 const url=assets.modelUrl('model.onnx');cache.set(url,new Response('corrupt'));
 let calls=0;globalThis.fetch=async url=>{calls++;assert.ok(url.startsWith('chrome-extension://'));return new Response('',{status:404});};
 await assert.rejects(assets.loadAsset('chrome-extension://test/','model.onnx',false),/Hugging Face/);
 assert.equal(calls,1);assert.equal(cache.has(url),false);
});
test('download rejects invalid bytes and never persists them',async()=>{
 globalThis.fetch=async url=>url.startsWith('chrome-extension://')?new Response('',{status:404}):new Response('invalid model');
 await assert.rejects(assets.loadAsset('chrome-extension://test/','model.onnx',true),/integrity/);
 assert.equal(cache.size,0);
 globalThis.fetch=originalFetch;
});
test('model URL pins revision and rejects arbitrary files',()=>{
 assert.ok(assets.modelUrl('model.onnx').includes(assets.MODEL_REVISION+'/browser/model.onnx'));
 assert.throws(()=>assets.modelUrl('../token'),/Unknown/);
});

import * as ort from 'onnxruntime-web/webgpu';
import { Tokenizer } from '@huggingface/tokenizers';
import { encodeComment } from './encoding';
import { loadAsset } from './model-assets';
import { TOXIC_LABELS } from '../shared/toxic';

let session: ort.InferenceSession | null = null;
let tokenizer: Tokenizer | null = null;
let backend = '';
let fallbackReason = '';
let chain: Promise<void> = Promise.resolve();

async function initialize(base: string, preference: string, allowDownload: boolean) {
  if (session) return;
  ort.env.wasm.wasmPaths = base + 'runtime/';
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  const [definitionBytes, configBytes] = await Promise.all(['tokenizer.json', 'tokenizer_config.json'].map(name => loadAsset(base, name, allowDownload)));
  const definition = JSON.parse(new TextDecoder().decode(definitionBytes));
  const config = JSON.parse(new TextDecoder().decode(configBytes));
  const model = new Uint8Array(await loadAsset(base, 'model.onnx', allowDownload));
  tokenizer = new Tokenizer(definition, config);
  if (preference !== 'wasm') {
    try {
      session = await ort.InferenceSession.create(model, { executionProviders: ['webgpu', 'wasm'], graphOptimizationLevel: 'all' });
      backend = 'webgpu';
    } catch (error) {
      if (preference === 'webgpu') throw error;
      fallbackReason = String(error);
    }
  }
  if (!session) {
    session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    backend = 'wasm';
  }
}

self.onmessage = (event: MessageEvent) => {
  const request = event.data;
  chain = chain.then(async () => {
    try {
      await initialize(request.base, request.preference, request.downloadMissingModel !== false);
      if (request.action === 'health') {
        self.postMessage({ id: request.id, result: { ok: true, backend, fallbackReason } });
        return;
      }
      const encoded = encodeComment(tokenizer!, request.text);
      const input_ids = new ort.Tensor('int64', BigInt64Array.from(encoded.ids), [1, 128]);
      const attention_mask = new ort.Tensor('int64', BigInt64Array.from(encoded.mask), [1, 128]);
      const start = performance.now();
      let output: ort.InferenceSession.ReturnType | undefined;
      try {
      output = await session!.run({ input_ids, attention_mask });
      const values = Array.from(output.logits.data as Float32Array);
      const scores = Object.fromEntries(TOXIC_LABELS.map((label, i) => [label, 1 / (1 + Math.exp(-values[i]))]));
      self.postMessage({ id: request.id, result: { ok: true, scores, backend, milliseconds: performance.now() - start } });
      } finally {
        input_ids.dispose(); attention_mask.dispose();
        if (output) Object.values(output).forEach(tensor => tensor.dispose());
      }
    } catch (error) {
      self.postMessage({ id: request.id, result: { ok: false, error: String(error), backend } });
    }
  });
};

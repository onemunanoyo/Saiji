import * as ort from 'onnxruntime-web/webgpu';
import { Tokenizer } from '@huggingface/tokenizers';
import { encodeComment } from './encoding';
import { TOXIC_LABELS } from '../shared/toxic';

let session: ort.InferenceSession | null = null;
let tokenizer: Tokenizer | null = null;
let backend = '';
let fallbackReason = '';
let chain: Promise<void> = Promise.resolve();

async function initialize(base: string, preference: string) {
  if (session) return;
  ort.env.wasm.wasmPaths = base + 'runtime/';
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  const responses = await Promise.all(['tokenizer.json', 'tokenizer_config.json'].map(name => fetch(base + 'model/' + name)));
  if (responses.some(response => !response.ok)) throw new Error('Model files are missing; run browser model preparation');
  const [definition, config] = await Promise.all(responses.map(response => response.json()));
  tokenizer = new Tokenizer(definition, config);
  if (preference !== 'wasm') {
    try {
      session = await ort.InferenceSession.create(base + 'model/model.onnx', { executionProviders: ['webgpu', 'wasm'], graphOptimizationLevel: 'all' });
      backend = 'webgpu';
    } catch (error) {
      if (preference === 'webgpu') throw error;
      fallbackReason = String(error);
    }
  }
  if (!session) {
    session = await ort.InferenceSession.create(base + 'model/model.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    backend = 'wasm';
  }
}

self.onmessage = (event: MessageEvent) => {
  const request = event.data;
  chain = chain.then(async () => {
    try {
      await initialize(request.base, request.preference);
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

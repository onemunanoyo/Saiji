import * as esbuild from 'esbuild';
import { cp, mkdir, readdir, access, rm, readFile, writeFile } from 'fs/promises';

const watch = process.argv.includes('--watch');
const store = process.argv.includes('--store');
const output = store ? 'release/extension' : 'dist';
const prod = store || process.env.NODE_ENV === 'production';

const common = {
  bundle:    true,
  minify:    prod,
  sourcemap: !prod,
  target:    ['chrome120'],
  platform:  'browser',
  define: {
    'process.env.NODE_ENV': prod ? '"production"' : '"development"',
  },
};

const entryPoints = [
  { in: 'src/inference/offscreen.ts', out: output + '/inference/offscreen' },
  { in: 'src/inference/worker.ts', out: output + '/inference/worker' },
  { in: 'src/content/index.ts',   out: output + '/content/index' },
  { in: 'src/background/index.ts', out: output + '/background/index' },
  { in: 'src/popup/index.tsx',    out: output + '/popup/index' },
  { in: 'src/options/index.tsx',  out: output + '/options/index' },
];

async function copyPublic() {
  if (store) {
    // Fixed generated output under this repository; never delete dist or source assets.
    const { resolve, dirname } = await import('node:path');
    const target = resolve(output);
    if (dirname(target) !== resolve('release') || target !== resolve('release/extension')) throw Error('Unsafe output path');
    await rm(target, { recursive: true, force: true });
  }
  await cp('public', output, { recursive: true });
  await cp('LICENSE', output + '/LICENSE.txt');
  await cp('third_party', output + '/licenses', { recursive: true });
  const notices = [];
  const visited = new Set();
  async function collect(name) {
    // guid-typescript belongs to the unused WebGL entry, not this WebGPU/WASM bundle.
    if (name === 'guid-typescript' || visited.has(name)) return; visited.add(name);
    const directory = 'node_modules/' + name;
    const info = JSON.parse(await readFile(directory + '/package.json', 'utf8'));
    let license = '';
    for (const file of await readdir(directory)) if (/^licen[cs]e(?:\.|$)/i.test(file)) { license = await readFile(directory + '/' + file, 'utf8'); break; }
    notices.push(`${name}@${info.version} — ${info.license}\n${license || 'See licenses/ONNXRuntime-LICENSE.txt for ONNX Runtime; upstream package: ' + JSON.stringify(info.repository)}\n`);
    for (const dependency of Object.keys(info.dependencies ?? {})) await collect(dependency);
  }
  const project = JSON.parse(await readFile('package.json', 'utf8'));
  for (const name of Object.keys(project.dependencies)) await collect(name);
  await writeFile(output + '/THIRD_PARTY_NOTICES.txt', notices.join('\n---\n'));
  await mkdir(output + '/runtime', { recursive: true });
  for (const name of await readdir('node_modules/onnxruntime-web/dist')) {
    if (/^ort-wasm-.*\.(mjs|wasm)$/.test(name)) await cp('node_modules/onnxruntime-web/dist/' + name, output + '/runtime/' + name);
  }
  if (store) { console.log('[saiji] Store build: model is downloaded from HF on demand.'); return; }
  try { await access('models/browser/model.onnx'); }
  catch { console.warn('[saiji] Browser model is absent. AI inference can download the verified model from Hugging Face when enabled.'); return; }
  await cp('models/browser', output + '/model', { recursive: true });
  console.log('[saiji] public/ → dist/ コピー完了');
}

async function build() {
  await copyPublic();

  if (watch) {
    const ctxs = await Promise.all(
      entryPoints.map(({ in: entryPoint, out: outfile }) =>
        esbuild.context({ ...common, format: entryPoint.startsWith('src/inference/') ? 'esm' : 'iife', entryPoints: [entryPoint], outfile: outfile + '.js' })
      )
    );
    await Promise.all(ctxs.map(ctx => ctx.watch()));
    console.log('[saiji] watch モード起動中...');
  } else {
    await Promise.all(
      entryPoints.map(({ in: entryPoint, out: outfile }) =>
        esbuild.build({ ...common, format: entryPoint.startsWith('src/inference/') ? 'esm' : 'iife', entryPoints: [entryPoint], outfile: outfile + '.js' })
      )
    );
    console.log('[saiji] ビルド完了 →', prod ? '本番' : '開発');
  }
}

build().catch(e => { console.error(e); process.exit(1); });

import * as esbuild from 'esbuild';
import { cp, mkdir, readdir, access } from 'fs/promises';

const watch = process.argv.includes('--watch');
const prod  = process.env.NODE_ENV === 'production';

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
  { in: 'src/inference/offscreen.ts', out: 'dist/inference/offscreen' },
  { in: 'src/inference/worker.ts', out: 'dist/inference/worker' },
  { in: 'src/content/index.ts',   out: 'dist/content/index' },
  { in: 'src/background/index.ts', out: 'dist/background/index' },
  { in: 'src/popup/index.tsx',    out: 'dist/popup/index' },
  { in: 'src/options/index.tsx',  out: 'dist/options/index' },
];

async function copyPublic() {
  await cp('public', 'dist', { recursive: true });
  await mkdir('dist/runtime', { recursive: true });
  for (const name of await readdir('node_modules/onnxruntime-web/dist')) {
    if (['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs'].includes(name)) await cp('node_modules/onnxruntime-web/dist/' + name, 'dist/runtime/' + name);
  }
  try { await access('models/browser/model.onnx'); }
  catch { console.warn('[saiji] Browser model is absent. Run tools/export_browser_model.py before using AI inference.'); return; }
  await cp('models/browser', 'dist/model', { recursive: true });
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

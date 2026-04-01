import * as esbuild from 'esbuild';
import { cp } from 'fs/promises';

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
  { in: 'src/content/index.ts',   out: 'dist/content/index' },
  { in: 'src/background/index.ts', out: 'dist/background/index' },
  { in: 'src/popup/index.tsx',    out: 'dist/popup/index' },
  { in: 'src/options/index.tsx',  out: 'dist/options/index' },
];

async function copyPublic() {
  await cp('public', 'dist', { recursive: true });
  console.log('[saiji] public/ → dist/ コピー完了');
}

async function build() {
  await copyPublic();

  if (watch) {
    const ctxs = await Promise.all(
      entryPoints.map(({ in: entryPoint, out: outfile }) =>
        esbuild.context({ ...common, entryPoints: [entryPoint], outfile: outfile + '.js' })
      )
    );
    await Promise.all(ctxs.map(ctx => ctx.watch()));
    console.log('[saiji] watch モード起動中...');
  } else {
    await Promise.all(
      entryPoints.map(({ in: entryPoint, out: outfile }) =>
        esbuild.build({ ...common, entryPoints: [entryPoint], outfile: outfile + '.js' })
      )
    );
    console.log('[saiji] ビルド完了 →', prod ? '本番' : '開発');
  }
}

build().catch(e => { console.error(e); process.exit(1); });

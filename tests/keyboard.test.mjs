import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/shared/keyboard.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { isImeComposing } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('detects IME composition Enter', () => {
  assert.equal(isImeComposing({ isComposing: true, keyCode: 13 }), true);
  assert.equal(isImeComposing({ isComposing: false, keyCode: 229 }), true);
  assert.equal(isImeComposing({ isComposing: false, keyCode: 13 }), false);
});

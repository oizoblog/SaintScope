import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { prepareDist } from './tools/prepare-dist.mjs';

await build({
  entryPoints:['ai-worker.js'],
  outfile:'ai-worker.bundle.js',
  bundle:true,
  format:'esm',
  platform:'browser',
  target:'es2022',
  minify:true,
  legalComments:'none',
});
mkdirSync('vendor', {recursive:true});
for (const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']) {
  copyFileSync(`node_modules/onnxruntime-web/dist/${name}`, `vendor/${name}`);
}
copyFileSync('node_modules/@huggingface/transformers/LICENSE', 'vendor/TRANSFORMERS-LICENSE.txt');
await prepareDist();

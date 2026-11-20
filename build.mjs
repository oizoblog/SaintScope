import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
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
function copyVendor(source, target) {
  const incoming = readFileSync(source);
  if (existsSync(target)) {
    const existing = readFileSync(target);
    const same = source.endsWith('.wasm') ? existing.equals(incoming)
      : existing.toString('utf8').replace(/\r\n/g, '\n') === incoming.toString('utf8').replace(/\r\n/g, '\n');
    if (same) return;
  }
  copyFileSync(source, target);
}
for (const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']) {
  copyVendor(`node_modules/onnxruntime-web/dist/${name}`, `vendor/${name}`);
}
copyVendor('node_modules/@huggingface/transformers/LICENSE', 'vendor/TRANSFORMERS-LICENSE.txt');
await prepareDist();

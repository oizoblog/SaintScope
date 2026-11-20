import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = resolve(root, 'dist');

const assets = [
  'index.html', 'app.js', 'saints.js', 'prompts.js', 'recognition-history.js',
  'ai-worker.bundle.js', 'sw.js', 'manifest.webmanifest',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'THIRD_PARTY_NOTICES.md',
  'vendor/ort-wasm-simd-threaded.mjs', 'vendor/ort-wasm-simd-threaded.wasm',
  'vendor/ONNXRUNTIME-LICENSE.txt', 'vendor/TRANSFORMERS-LICENSE.txt',
];

export async function prepareDist() {
  if (dirname(dist) !== root || dist === root) throw Error('Unsafe dist path');
  await rm(dist, {recursive:true,force:true});
  await mkdir(dist, {recursive:true});
  for (const asset of assets) {
    const source = resolve(root, asset);
    const target = resolve(dist, asset);
    if (!source.startsWith(root + sep) || !target.startsWith(dist + sep)) throw Error(`Unsafe asset path: ${asset}`);
    await mkdir(dirname(target), {recursive:true});
    await copyFile(source, target);
  }
}

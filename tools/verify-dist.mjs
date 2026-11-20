import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root,'dist');
const required = [
  'index.html','app.js','saints.js','prompts.js','recognition-history.js',
  'ai-worker.bundle.js','sw.js','manifest.webmanifest',
  'icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png',
  'THIRD_PARTY_NOTICES.md',
  'vendor/ort-wasm-simd-threaded.mjs','vendor/ort-wasm-simd-threaded.wasm',
  'vendor/ONNXRUNTIME-LICENSE.txt','vendor/TRANSFORMERS-LICENSE.txt',
];
async function filesAt(directory, prefix='') {
  const files = [];
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const name = prefix + entry.name;
    files.push(...(entry.isDirectory() ? await filesAt(join(directory,entry.name),name + '/') : [name]));
  }
  return files;
}
assert.deepEqual((await filesAt(dist)).sort(),required.sort());
for (const name of required) assert.deepEqual(await readFile(join(dist,name)),await readFile(join(root,name)),name);
const html = await readFile(join(dist,'index.html'),'utf8');
const manifest = JSON.parse(await readFile(join(dist,'manifest.webmanifest'),'utf8'));
const worker = await readFile(join(dist,'ai-worker.bundle.js'),'utf8');
const sw = await readFile(join(dist,'sw.js'),'utf8');
assert.match(html,/<html lang="zh-CN">/);
assert.equal(manifest.start_url,'./');
assert.equal(manifest.scope,'./');
assert.match(worker,/ort-wasm-simd-threaded\.wasm/);
for (const name of required.filter(name => !name.startsWith('vendor/') && name !== 'THIRD_PARTY_NOTICES.md')) {
  if (name !== 'sw.js') assert.ok(sw.includes(`'./${name}'`) || name === 'index.html',`SW precache: ${name}`);
}
process.stdout.write(`Verified ${required.length} dist files and relative PWA paths.\n`);

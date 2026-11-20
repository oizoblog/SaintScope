'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const guard = require('../image-guard.js');

const be16 = n => [n >>> 8 & 255, n & 255];
const be32 = n => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
const le32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const blob = (bytes, type = '') => new Blob([bytes], {type});
const valid = async bytes => assert.equal(await guard.validate(blob(bytes)), null);
const rejected = async bytes => assert.match(await guard.validate(blob(bytes)), /无效|过大|仅支持|无法读取/);

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(name, data) {
  const content = Buffer.concat([Buffer.from(name), Buffer.from(data)]);
  return Buffer.concat([Buffer.from(be32(data.length)), content, Buffer.from(be32(crc32(content)))]);
}

function png(width, height) {
  const header = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.from([...be32(width), ...be32(height), 8, 6, 0, 0, 0]);
  const pixels = zlib.deflateSync(Buffer.from([0,0,0,0,0]));
  return Buffer.concat([header, pngChunk('IHDR', ihdr), pngChunk('IDAT', pixels), pngChunk('IEND', [])]);
}

function jpeg(width, height, prefixBytes = 0) {
  const parts = [Buffer.from([255,216])];
  while (prefixBytes > 0) {
    const payload = Math.min(prefixBytes, 65533);
    parts.push(Buffer.from([255,225, ...be16(payload + 2)]), Buffer.alloc(payload));
    prefixBytes -= payload;
  }
  parts.push(Buffer.from([255,192,0,11,8,...be16(height),...be16(width),1,1,17,0]));
  parts.push(Buffer.from([255,218,0,8,1,1,0,0,63,0,0,255,217]));
  return Buffer.concat(parts);
}

function webpChunk(name, payload) {
  return Buffer.concat([Buffer.from(name), Buffer.from(le32(payload.length)), Buffer.from(payload),
    payload.length & 1 ? Buffer.from([0]) : Buffer.alloc(0)]);
}
function vp8(width, height) {
  return Buffer.from([0,0,0,0x9d,1,0x2a,width & 255,width >>> 8,height & 255,height >>> 8]);
}
function vp8l(width, height) {
  const w = width - 1, h = height - 1;
  return Buffer.from([0x2f,w & 255,((w >>> 8) & 0x3f) | ((h & 3) << 6),
    (h >>> 2) & 255,(h >>> 10) & 15]);
}
function webp(kind, width, height) {
  const image = kind === 'VP8L' ? webpChunk('VP8L', vp8l(width, height)) : webpChunk('VP8 ', vp8(width, height));
  const x = kind === 'VP8X' ? webpChunk('VP8X', Buffer.from([0,0,0,0,
    ...le32(width - 1).slice(0,3),...le32(height - 1).slice(0,3)])) : Buffer.alloc(0);
  const body = Buffer.concat([Buffer.from('WEBP'), x, image]);
  return Buffer.concat([Buffer.from('RIFF'), Buffer.from(le32(body.length)), body]);
}

test('real signatures control JPEG, PNG and WebP acceptance, independently of MIME', async () => {
  await valid(jpeg(20, 10));
  await valid(png(1, 1));
  for (const kind of ['VP8 ', 'VP8L', 'VP8X']) await valid(webp(kind, 20, 10));
  // Public, synthetic 2 × 2 color squares generated locally with Pillow 12.1.1.
  for (const base64 of [
    'UklGRjgAAABXRUJQVlA4ICwAAACQAQCdASoCAAIAAgA0JaACdLoAA5gA/u4KZ+tt383vA/9cB/84D/5wH9FAAA==',
    'UklGRh4AAABXRUJQVlA4TBEAAAAvAUAAAAdQmSIXpf+BiOh/AAA=',
    'UklGRlgAAABXRUJQVlA4WAoAAAAQAAAAAQAAAQAAQUxQSAUAAAAAZGRkZABWUDggLAAAAJABAJ0BKgIAAgACADQloAJ0ugADmAD+7gpn623fze8D/1wH/zgP/nAf0UAA'
  ]) await valid(Buffer.from(base64, 'base64'));
  assert.equal(await guard.validate(blob(png(1,1), 'image/jpeg')), null);
  await rejected(Buffer.from('<svg width="50000" height="50000"></svg>'));
  await rejected(Buffer.from('not an image'));
  await rejected(Buffer.from([137,80,78,71,0,0]));
  await rejected(Buffer.from([255,216,255,217]));
  const heic = Buffer.alloc(40);
  heic.write('ftyp', 4);
  await rejected(heic);
});

test('12 MiB, 4096 edge and 16 million pixels are inclusive limits', async () => {
  const base = jpeg(4000, 4000);
  await valid(Buffer.concat([base.subarray(0, -2), Buffer.alloc(guard.MAX_BYTES - base.length), base.subarray(-2)]));
  assert.match(await guard.validate(blob(Buffer.alloc(guard.MAX_BYTES + 1))), /12 MiB/);
  await valid(jpeg(4096, 3906));
  assert.match(await guard.validate(blob(jpeg(4097, 1))), /4096/);
  await valid(jpeg(4000, 4000));
  assert.match(await guard.validate(blob(jpeg(4001, 4000))), /1600 万/);
  assert.match(await guard.validate(blob(png(4096, 4096))), /1600 万/);
  assert.match(await guard.validate(blob(png(5000, 1))), /4096/);
});

test('JPEG rejects delayed or missing SOF, truncation and invalid segment lengths', async () => {
  await rejected(jpeg(5000, 10, guard.JPEG_SCAN_BYTES + 1));
  await rejected(Buffer.from([255,216,255,218,0,8,1,1,0,0,63,0,255,217]));
  await rejected(jpeg(10,10).subarray(0, -2));
  const bad = jpeg(10,10);
  bad[4] = 0; bad[5] = 1;
  await rejected(bad);
  const bad2 = jpeg(10,10);
  bad2[4] = 255; bad2[5] = 255;
  await rejected(bad2);
});

test('WebP VP8, VP8L and VP8X enforce dimensions and RIFF structure', async () => {
  for (const kind of ['VP8 ', 'VP8L', 'VP8X']) {
    await valid(webp(kind, 4096, 3906));
    assert.match(await guard.validate(blob(webp(kind, 4097, 1))), /4096/);
    assert.match(await guard.validate(blob(webp(kind, 4001, 4000))), /1600 万/);
    await rejected(webp(kind, 10, 10).subarray(0, -1));
  }
  const badRiff = webp('VP8X', 10, 10);
  badRiff[4] = 0;
  await rejected(badRiff);
  const badVp8 = webp('VP8 ', 10, 10);
  badVp8[23] = 0;
  await rejected(badVp8);
  const badVp8l = webp('VP8L', 10, 10);
  badVp8l[20] = 0;
  await rejected(badVp8l);
  const badVp8x = webp('VP8X', 10, 10);
  badVp8x[20] = 2; // animation is not accepted as a still photo
  await rejected(badVp8x);
});

test('PNG validates IHDR, chunk CRC and terminal IEND', async () => {
  const badCrc = png(1,1);
  badCrc[29] ^= 1;
  await rejected(badCrc);
  await rejected(png(1,1).subarray(0, -1));
  const badDepth = png(1,1);
  badDepth[24] = 3;
  await rejected(badDepth);
});

test('read failures and unknown dimensions fail closed', async () => {
  assert.match(await guard.validate({size:20,arrayBuffer:async () => {throw Error('read failure')}}), /无法读取/);
  assert.match(await guard.validate({size:20,arrayBuffer:async () => new Uint8Array(4).buffer}), /无效/);
  assert.match(await guard.validate({size:20}), /仅支持/);
  assert.match(guard.dimensionError(0, 200), /无效/);
});

test('worker rejects invalid files before full decode or CLIP initialization', async () => {
  let decoded = 0, loaded = 0;
  const messages = [];
  const source = fs.readFileSync(path.join(__dirname, '../ai-worker.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replaceAll('import.meta.url', "'https://example.test/ai-worker.js'");
  const context = {
    ImageGuard:guard, Blob, URL, performance:{now:() => 0},
    env:{backends:{onnx:{wasm:{}}},fetch:async () => ({ok:false})},
    RawImage:{fromBlob:async () => { decoded++; throw Error('decoded'); }},
    AutoTokenizer:{from_pretrained:async () => {loaded++;}},
    AutoProcessor:{from_pretrained:async () => {loaded++;}},
    CLIPModel:{from_pretrained:async () => {loaded++;}},
    self:{postMessage:message => messages.push(message)}
  };
  vm.runInNewContext(source, context);
  await context.self.onmessage({data:{type:'identify',file:blob(Buffer.from('<svg></svg>')),entries:[{id:'peter',prompts:[]}]}});
  assert.equal(decoded, 0);
  assert.equal(loaded, 0);
  assert.equal(messages.at(-1).type, 'error');
  context.RawImage.fromBlob = async () => { decoded++; return {width:5000,height:10}; };
  await context.self.onmessage({data:{type:'identify',file:blob(jpeg(1,1)),entries:[{id:'peter',prompts:[]}]}});
  assert.equal(decoded, 1);
  assert.equal(loaded, 0);
  assert.match(messages.at(-1).message, /4096/);
  context.RawImage.fromBlob = async () => { decoded++; throw Error('decode failed'); };
  await context.self.onmessage({data:{type:'identify',file:blob(jpeg(1,1)),entries:[{id:'peter',prompts:[]}]}});
  assert.equal(decoded, 2);
  assert.equal(loaded, 0);
  assert.match(messages.at(-1).message, /decode failed/);
});

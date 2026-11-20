'use strict';

const ImageGuard = (() => {
  const MAX_BYTES = 12 * 1024 * 1024;
  const MAX_EDGE = 4096;
  const MAX_PIXELS = 16_000_000;
  const JPEG_SCAN_BYTES = 1024 * 1024;
  const invalid = '图片格式或文件结构无效。仅支持 JPEG、PNG、WebP；请换一张照片。';
  const u16 = (b, p) => b[p] * 256 + b[p + 1];
  const u16le = (b, p) => b[p] + b[p + 1] * 256;
  const u32 = (b, p) => b[p] * 0x1000000 + b[p + 1] * 0x10000 + b[p + 2] * 256 + b[p + 3];
  const u32le = (b, p) => b[p] + b[p + 1] * 256 + b[p + 2] * 0x10000 + b[p + 3] * 0x1000000;
  const matches = (b, p, value) => p + value.length <= b.length && [...value].every((c, i) => b[p + i] === c.charCodeAt(0));

  function crc32(bytes, start, end) {
    let crc = -1;
    for (let i = start; i < end; i++) {
      crc ^= bytes[i];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  }

  function pngDimensions(b) {
    if (b.length < 45 || !matches(b, 0, '\x89PNG\r\n\x1a\n')) return null;
    let at = 8, size = null, idat = false, ended = false;
    while (at + 12 <= b.length) {
      const length = u32(b, at);
      if (length > b.length - at - 12) return null;
      const type = String.fromCharCode(...b.subarray(at + 4, at + 8));
      const end = at + 12 + length;
      if (crc32(b, at + 4, at + 8 + length) !== u32(b, at + 8 + length)) return null;
      if (at === 8) {
        if (type !== 'IHDR' || length !== 13) return null;
        const width = u32(b, at + 8), height = u32(b, at + 12);
        const depth = b[at + 16], color = b[at + 17];
        const depths = {0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
        if (!width || !height || !depths[color]?.includes(depth) || b[at + 18] !== 0 ||
            b[at + 19] !== 0 || b[at + 20] > 1) return null;
        size = {width, height};
      } else if (type === 'IHDR') return null;
      else if (type === 'IDAT') idat = true;
      else if (type === 'IEND') {
        if (length !== 0 || !idat || end !== b.length) return null;
        ended = true;
        break;
      }
      at = end;
    }
    return ended ? size : null;
  }

  function jpegDimensions(b) {
    if (b.length < 14 || b[0] !== 255 || b[1] !== 216 ||
        b[b.length - 2] !== 255 || b[b.length - 1] !== 217) return null;
    const budget = Math.min(b.length, JPEG_SCAN_BYTES);
    let at = 2, size = null;
    while (at < budget) {
      if (b[at++] !== 255) return null;
      while (at < budget && b[at] === 255) at++;
      if (at >= budget) return null;
      const marker = b[at++];
      if (marker === 0 || marker === 216 || marker === 217 || marker === 1 ||
          (marker >= 208 && marker <= 215)) return null;
      if (at + 2 > budget) return null;
      const length = u16(b, at);
      if (length < 2 || length > budget - at || length > b.length - at) return null;
      if (marker === 218) {
        const count = b[at + 2];
        return size && length === 6 + 2 * count ? size : null;
      }
      if ((marker >= 192 && marker <= 195) || (marker >= 197 && marker <= 199) ||
          (marker >= 201 && marker <= 203) || (marker >= 205 && marker <= 207)) {
        if (size || length < 11) return null;
        const count = b[at + 7];
        if (count < 1 || count > 4 || length !== 8 + 3 * count || b[at + 2] === 0) return null;
        size = {width:u16(b, at + 5), height:u16(b, at + 3)};
        if (!size.width || !size.height) return null;
      }
      at += length;
    }
    return null; // SOF and SOS must both be inside the explicit 1 MiB marker scan budget.
  }

  function vp8Dimensions(b, at, length) {
    if (length < 10 || (b[at] & 1) || b[at + 3] !== 0x9d ||
        b[at + 4] !== 1 || b[at + 5] !== 0x2a) return null;
    return {width:u16le(b, at + 6) & 0x3fff, height:u16le(b, at + 8) & 0x3fff};
  }

  function vp8lDimensions(b, at, length) {
    if (length < 5 || b[at] !== 0x2f || (b[at + 4] & 0xe0)) return null;
    return {
      width:1 + b[at + 1] + ((b[at + 2] & 0x3f) << 8),
      height:1 + (b[at + 2] >> 6) + (b[at + 3] << 2) + ((b[at + 4] & 15) << 10)
    };
  }

  function webpDimensions(b) {
    if (b.length < 26 || !matches(b, 0, 'RIFF') || !matches(b, 8, 'WEBP') || u32le(b, 4) !== b.length - 8) return null;
    let at = 12, canvas = null, image = null, first = true, extended = false;
    while (at + 8 <= b.length) {
      const type = String.fromCharCode(...b.subarray(at, at + 4));
      const length = u32le(b, at + 4), data = at + 8;
      if (length > b.length - data || (length & 1) > b.length - data - length) return null;
      if (first) {
        if (type === 'VP8X') {
          if (length !== 10 || (b[data] & 0xc3) || b[data + 1] || b[data + 2] || b[data + 3]) return null;
          canvas = {width:1 + b[data + 4] + (b[data + 5] << 8) + (b[data + 6] << 16),
                    height:1 + b[data + 7] + (b[data + 8] << 8) + (b[data + 9] << 16)};
          extended = true;
        } else if (type !== 'VP8 ' && type !== 'VP8L') return null;
      }
      if (type === 'VP8 ' || type === 'VP8L') {
        if (image) return null;
        image = type === 'VP8 ' ? vp8Dimensions(b, data, length) : vp8lDimensions(b, data, length);
        if (!image) return null;
      }
      at = data + length + (length & 1);
      first = false;
    }
    if (at !== b.length || !image || (extended && (!canvas || canvas.width !== image.width || canvas.height !== image.height))) return null;
    return canvas || image;
  }

  function dimensions(bytes) {
    if (bytes.length >= 8 && matches(bytes, 0, '\x89PNG\r\n\x1a\n')) return pngDimensions(bytes);
    if (bytes.length >= 2 && bytes[0] === 255 && bytes[1] === 216) return jpegDimensions(bytes);
    if (bytes.length >= 12 && matches(bytes, 0, 'RIFF') && matches(bytes, 8, 'WEBP')) return webpDimensions(bytes);
    return null;
  }

  function dimensionError(width, height) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 ||
        width > MAX_EDGE || height > MAX_EDGE || width * height > MAX_PIXELS) {
      return '图片尺寸过大或无效（上限为 4096 像素边长、1600 万像素）。请在本机缩小照片后重试。';
    }
    return null;
  }

  async function validate(file) {
    if (!file || !Number.isSafeInteger(file.size) || file.size <= 0) return '图片文件为空或无效。';
    if (file.size > MAX_BYTES) return '图片文件过大（上限为 12 MiB）。请在本机缩小照片后重试。';
    if (typeof file.arrayBuffer !== 'function') return invalid;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length !== file.size) return invalid;
      const size = dimensions(bytes);
      return size ? dimensionError(size.width, size.height) : invalid;
    } catch {
      return '无法读取图片文件。请换一张照片后重试。';
    }
  }

  return {MAX_BYTES, MAX_EDGE, MAX_PIXELS, JPEG_SCAN_BYTES, dimensions, dimensionError, validate};
})();

if (typeof module !== 'undefined') module.exports = ImageGuard;

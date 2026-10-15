// Generates build/icons/icon.png (256x256) from scratch — no native deps.
// Renders at 4x (1024) with simple box-filter downsampling for smooth edges.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const S = 1024;
const OUT = 256;
const SS = S / OUT; // 4

const buf = new Uint8Array(S * S * 4);

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const ix = Math.max(x0 + r, Math.min(x, x1 - r));
  const iy = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - ix;
  const dy = y - iy;
  return dx * dx + dy * dy <= r * r;
}

function px(x, y) {
  // dark slate rounded-square background
  if (inRoundedRect(x, y, 0, 0, S - 1, S - 1, 220)) {
    // folder tab (upper-left bump)
    if (inRoundedRect(x, y, 250, 260, 570, 400, 45)) return [59, 130, 246, 255];
    // folder body
    if (inRoundedRect(x, y, 220, 350, 810, 780, 60)) {
      // lighter lid highlight band
      if (y >= 350 && y <= 415) return [96, 165, 250, 255];
      return [59, 130, 246, 255];
    }
    return [30, 41, 59, 255];
  }
  return [0, 0, 0, 0];
}

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const [r, g, b, a] = px(x, y);
    const i = (y * S + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  }
}

// downsample SS x SS blocks by averaging
const out = Buffer.alloc(OUT * OUT * 4);
for (let oy = 0; oy < OUT; oy++) {
  for (let ox = 0; ox < OUT; ox++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = ((oy * SS + sy) * S + (ox * SS + sx)) * 4;
        r += buf[i];
        g += buf[i + 1];
        b += buf[i + 2];
        a += buf[i + 3];
      }
    }
    const n = SS * SS;
    const j = (oy * OUT + ox) * 4;
    out[j] = Math.round(r / n);
    out[j + 1] = Math.round(g / n);
    out[j + 2] = Math.round(b / n);
    out[j + 3] = Math.round(a / n);
  }
}

// --- minimal PNG encoder ---
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(b) {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OUT, 0);
ihdr.writeUInt32BE(OUT, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type RGBA
// 10..12 stay 0: compression, filter, interlace

const raw = Buffer.alloc(OUT * (1 + OUT * 4));
for (let y = 0; y < OUT; y++) {
  raw[y * (1 + OUT * 4)] = 0; // filter: none
  out.copy(raw, y * (1 + OUT * 4) + 1, y * OUT * 4, (y + 1) * OUT * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const dest = path.resolve("build/icons/icon.png");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, png);
console.log(`wrote ${dest} (${png.length} bytes)`);
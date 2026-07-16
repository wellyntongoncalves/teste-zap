// Gera os ícones do PWA a partir da cor da marca, sem depender de nenhuma
// biblioteca de imagem: um PNG é só zlib sobre scanlines cruas.
//
// Rode com `node scripts/generate-icons.js` sempre que a marca mudar — os
// ícones antigos eram azuis (#2f5c8a) e não tinham relação com o design system.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BRAND = [0x00, 0x96, 0x6b]; // --brand light (#00966B), validado pelo skill de dataviz
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filtro "None"
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Distância de um ponto ao segmento — é o que dá traço de espessura uniforme,
// inclusive nas quinas do M.
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function insideRoundedRect(x, y, size, radius) {
  const min = radius;
  const max = size - radius;
  const cx = Math.min(Math.max(x, min), max);
  const cy = Math.min(Math.max(y, min), max);
  return Math.hypot(x - cx, y - cy) <= radius;
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22; // mesma pegada dos ícones de iOS/Android

  // O "M" repete a brand-badge do app (canto superior esquerdo da interface).
  const stroke = size * 0.085;
  const top = size * 0.31;
  const bottom = size * 0.69;
  const left = size * 0.3;
  const right = size * 0.7;
  const mid = size * 0.545;
  const center = size * 0.5;

  const segments = [
    [left, bottom, left, top], // haste esquerda
    [left, top, center, mid], // diagonal desce
    [center, mid, right, top], // diagonal sobe
    [right, top, right, bottom] // haste direita
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      if (!insideRoundedRect(px, py, size, radius)) {
        rgba[i + 3] = 0; // fora do cartão: transparente
        continue;
      }

      const distance = Math.min(...segments.map((s) => distToSegment(px, py, ...s)));
      // Meio pixel de transição: sem isso o M sai serrilhado.
      const inLetter = Math.max(0, Math.min(1, (stroke / 2 - distance) / 1.2));

      const color = [
        Math.round(BRAND[0] * (1 - inLetter) + WHITE[0] * inLetter),
        Math.round(BRAND[1] * (1 - inLetter) + WHITE[1] * inLetter),
        Math.round(BRAND[2] * (1 - inLetter) + WHITE[2] * inLetter)
      ];

      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = 255;
    }
  }

  return encodePng(size, size, rgba);
}

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180]
];

for (const [name, size] of targets) {
  const file = path.join(__dirname, '..', 'public', name);
  fs.writeFileSync(file, drawIcon(size));
  console.log(`gerado ${name} (${size}x${size})`);
}

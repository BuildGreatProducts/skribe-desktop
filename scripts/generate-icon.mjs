import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const size = 32;
const paper = [0xfa, 0xf7, 0xf2, 0xff];
const ink = [0x1e, 0x2a, 0x3a, 0xff];
const warm = [0xb8, 0x73, 0x2a, 0xff];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function setPixel(row, x, color) {
  const offset = 1 + x * 4;
  row[offset] = color[0];
  row[offset + 1] = color[1];
  row[offset + 2] = color[2];
  row[offset + 3] = color[3];
}

const rows = [];
for (let y = 0; y < size; y += 1) {
  const row = Buffer.alloc(1 + size * 4);
  row[0] = 0;
  for (let x = 0; x < size; x += 1) {
    setPixel(row, x, paper);
    const inLeftStroke = x >= 8 && x <= 11 && y >= 6 && y <= 25;
    const inRightStroke = x >= 20 && x <= 23 && y >= 6 && y <= 25;
    const inDiagonal = Math.abs(x - (8 + Math.round((y - 6) * 0.75))) <= 1 && y >= 6 && y <= 25;
    const inWarmFoot = y >= 24 && y <= 26 && x >= 8 && x <= 23;
    if (inLeftStroke || inRightStroke || inDiagonal) {
      setPixel(row, x, ink);
    }
    if (inWarmFoot) {
      setPixel(row, x, warm);
    }
  }
  rows.push(row);
}

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(Buffer.concat(rows))),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = resolve('src-tauri', 'icons');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'icon.png'), png);
console.log(`Wrote ${resolve(outDir, 'icon.png')} (${png.length} bytes)`);

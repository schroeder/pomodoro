// Dependency-free PWA icon generator.
//
// Erzeugt einfache Platzhalter-Icons (192x192, 512x512 und eine maskable
// Variante) als echte PNG-Dateien in public/icons/. Verwendet ausschließlich
// die Node-Standardbibliothek (zlib), sodass keine zusätzliche Abhängigkeit
// (z. B. sharp) nötig ist.
//
// Motiv: Solide Fläche in der Fokus-Akzentfarbe (--color-focus, #c0552e) mit
// einem hellen, zentrierten Kreis als schlichtes Tomaten-/Timer-Glyph.
// Die maskable-Variante nutzt einen größeren "Safe Zone"-Rand.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

// Farben (RGB) – abgeleitet aus tokens.css.
const FOCUS = [0xc0, 0x55, 0x2e]; // --color-focus
const FOCUS_CONTRAST = [0xff, 0xff, 0xff]; // heller Vordergrund

/** Berechnet die CRC32-Prüfsumme (für PNG-Chunks). */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Baut einen PNG-Chunk (Länge + Typ + Daten + CRC). */
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Zeichnet ein Icon und gibt es als PNG-Buffer zurück.
 * @param {number} size Kantenlänge in Pixeln.
 * @param {number} glyphRadiusRatio Radius des Kreises relativ zur Kantenlänge.
 */
function renderIcon(size, glyphRadiusRatio) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * glyphRadiusRatio;
  // Innerer "Stiel"/Loch-Kreis für ein dezentes Timer-Motiv.
  const innerR = r * 0.42;

  // Rohbild: pro Zeile ein Filter-Byte (0) + RGB je Pixel.
  const bytesPerPixel = 3;
  const stride = size * bytesPerPixel;
  const raw = Buffer.alloc((stride + 1) * size);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // Filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let color = FOCUS;
      if (dist <= r && dist >= innerR) {
        color = FOCUS_CONTRAST;
      }
      const off = rowStart + 1 + x * bytesPerPixel;
      raw[off] = color[0];
      raw[off + 1] = color[1];
      raw[off + 2] = color[2];
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = [
  ['pwa-192x192.png', renderIcon(192, 0.34)],
  ['pwa-512x512.png', renderIcon(512, 0.34)],
  // maskable: kleineres Glyph wegen Safe Zone (Icon darf beschnitten werden).
  ['maskable-512x512.png', renderIcon(512, 0.28)],
];

for (const [name, buf] of files) {
  writeFileSync(resolve(outDir, name), buf);
  console.log(`generated ${name} (${buf.length} bytes)`);
}

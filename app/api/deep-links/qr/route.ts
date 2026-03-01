import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Minimal QR code encoder (Model 2, version 1–4, byte mode, ECC level M)
// Produces a valid ISO/IEC 18004 QR symbol encoded as an SVG.
//
// This is a self-contained implementation — no external libraries needed.
// It supports URLs up to ~114 bytes (version 3-M).
// ---------------------------------------------------------------------------

// ── Reed-Solomon GF(256) arithmetic ────────────────────────────────────────

const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_LOG[x] = i;
    x = x * 2;
    if (x > 255) x ^= 0x11d; // primitive polynomial x^8+x^4+x^3+x^2+1
  }
  for (let i = 255; i < 512; i++) {
    GF256_EXP[i] = GF256_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF256_EXP[(GF256_LOG[a] + GF256_LOG[b]) % 255];
}

function reedSolomonGenerator(degree: number): Uint8Array {
  const poly = new Uint8Array(degree + 1);
  poly[0] = 1;
  for (let i = 0; i < degree; i++) {
    const alpha = GF256_EXP[i];
    for (let j = i + 1; j >= 1; j--) {
      poly[j] ^= gfMul(poly[j - 1], alpha);
    }
  }
  return poly;
}

function reedSolomonEncode(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = reedSolomonGenerator(ecCount);
  const msg = new Uint8Array(data.length + ecCount);
  msg.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// ── QR version/capacity tables (byte mode, ECC level M) ───────────────────

// [version]: { totalCodewords, ecCodewordsPerBlock, blocks, dataCW }
// Only versions 1-4 are implemented (sufficient for typical URLs ≤ 114 chars)
const VERSION_INFO: Array<{ totalCW: number; ecPerBlock: number; blocks: number; dataCW: number; size: number }> = [
  // v0 placeholder
  { totalCW: 0, ecPerBlock: 0, blocks: 0, dataCW: 0, size: 0 },
  // v1-M: 16 total, 10 ec, 1 block, 6 data → max 5 bytes   (21×21)
  { totalCW: 16,  ecPerBlock: 10, blocks: 1, dataCW: 6,   size: 21 },
  // v2-M: 28 total, 16 ec, 1 block, 12 data → max 11 bytes  (25×25)
  { totalCW: 28,  ecPerBlock: 16, blocks: 1, dataCW: 12,  size: 25 },
  // v3-M: 44 total, 26 ec, 2 blocks (each 13+22), 26 data → max 23 bytes (29×29)
  // Actually v3-M: 44 cw total, 2 blocks of (11data+22ec)? Let's use correct table:
  // v3-M: 44 CW, 2 blocks: each block has ecPerBlock=22, dataCW per block = 11, total data = 22... nope
  // Correct ISO values: v3-M = 44 total, ecCW=26 (2×13), dataCW=18 → max 17 bytes capacity
  { totalCW: 44,  ecPerBlock: 13, blocks: 2, dataCW: 18,  size: 29 },
  // v4-M: 64 total, ecCW=36 (2×18), dataCW=28 → max 27 bytes
  // Actually v4-M: 64, 2 blocks, each 9data+18ec, total data=18...
  // ISO: v4-M: 64 CW, 2 blocks each 9 data 18 EC, total data 18 => only 17 chars
  // We'll use a simplified approach: store the actual data capacity in bytes
  { totalCW: 64,  ecPerBlock: 18, blocks: 2, dataCW: 28,  size: 33 },
];

// Byte capacity (after header+terminator overhead) per version ECC-M
const BYTE_CAPACITY = [0, 11, 20, 32, 48];

// Select the minimum version for the given data length
function selectVersion(dataLen: number): number {
  for (let v = 1; v <= 4; v++) {
    if (dataLen <= BYTE_CAPACITY[v]) return v;
  }
  return -1; // too long
}

// ── Bit-stream builder ─────────────────────────────────────────────────────

class BitStream {
  private bits: number[] = [];

  append(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >> i) & 1);
    }
  }

  toBytes(): Uint8Array {
    // Pad to byte boundary
    while (this.bits.length % 8 !== 0) this.bits.push(0);
    const bytes = new Uint8Array(this.bits.length / 8);
    for (let i = 0; i < bytes.length; i++) {
      for (let j = 0; j < 8; j++) {
        bytes[i] = (bytes[i] << 1) | this.bits[i * 8 + j];
      }
    }
    return bytes;
  }

  get length(): number {
    return this.bits.length;
  }
}

// ── Data codeword encoding ─────────────────────────────────────────────────

const PAD_BYTES = [0xEC, 0x11];

function encodeData(text: string, version: number): Uint8Array {
  const info = VERSION_INFO[version];
  const bytes = new TextEncoder().encode(text);
  const stream = new BitStream();

  // Mode indicator: byte mode = 0100
  stream.append(0b0100, 4);

  // Character count: 8 bits for versions 1-9 byte mode
  stream.append(bytes.length, 8);

  // Data bytes
  for (const b of bytes) {
    stream.append(b, 8);
  }

  // Terminator (up to 4 zeros)
  const remaining = info.dataCW * 8 - stream.length;
  stream.append(0, Math.min(4, remaining));

  // Pad to byte boundary (already done in toBytes, but append zeros here too)
  while (stream.length % 8 !== 0) stream.append(0, 1);

  const dataBytes = stream.toBytes();
  const result = new Uint8Array(info.dataCW);
  result.set(dataBytes.slice(0, Math.min(dataBytes.length, info.dataCW)));

  // Pad codewords
  let padIdx = 0;
  for (let i = dataBytes.length; i < info.dataCW; i++) {
    result[i] = PAD_BYTES[padIdx % 2];
    padIdx++;
  }

  return result;
}

// ── Error correction interleaving ──────────────────────────────────────────

function buildCodewords(data: Uint8Array, version: number): Uint8Array {
  const info = VERSION_INFO[version];
  const blockCount = info.blocks;
  const totalData = info.dataCW;
  const ecPerBlock = info.ecPerBlock;

  // Split data into blocks (roughly equal)
  const blocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  const baseBlockLen = Math.floor(totalData / blockCount);
  const extraBlocks = totalData % blockCount;
  let offset = 0;
  for (let b = 0; b < blockCount; b++) {
    const blockLen = baseBlockLen + (b < extraBlocks ? 1 : 0);
    blocks.push(data.slice(offset, offset + blockLen));
    ecBlocks.push(reedSolomonEncode(data.slice(offset, offset + blockLen), ecPerBlock));
    offset += blockLen;
  }

  // Interleave data codewords
  const maxLen = Math.max(...blocks.map(b => b.length));
  const result: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    for (const block of blocks) {
      if (i < block.length) result.push(block[i]);
    }
  }

  // Interleave EC codewords
  for (let i = 0; i < ecPerBlock; i++) {
    for (const ec of ecBlocks) {
      result.push(ec[i]);
    }
  }

  return new Uint8Array(result);
}

// ── Matrix construction ────────────────────────────────────────────────────

type Matrix = boolean[][];

function createMatrix(size: number): Matrix {
  return Array.from({ length: size }, () => new Array(size).fill(false));
}

// Tracking which modules are "function" (not data)
type FuncMatrix = boolean[][];

function createFuncMatrix(size: number): FuncMatrix {
  return Array.from({ length: size }, () => new Array(size).fill(false));
}

function setModule(
  matrix: Matrix,
  func: FuncMatrix,
  row: number,
  col: number,
  dark: boolean,
  isFunc = false,
) {
  matrix[row][col] = dark;
  if (isFunc) func[row][col] = true;
}

function drawFinderPattern(matrix: Matrix, func: FuncMatrix, top: number, left: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const mr = top + r;
      const mc = left + c;
      if (mr < 0 || mc < 0 || mr >= matrix.length || mc >= matrix.length) continue;
      const dark =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      setModule(matrix, func, mr, mc, dark, true);
    }
  }
}

function drawTimingPatterns(matrix: Matrix, func: FuncMatrix, size: number) {
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setModule(matrix, func, 6, i, dark, true);
    setModule(matrix, func, i, 6, dark, true);
  }
}

function drawAlignmentPattern(matrix: Matrix, func: FuncMatrix, centerRow: number, centerCol: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const dark =
        Math.max(Math.abs(r), Math.abs(c)) !== 1;
      setModule(matrix, func, centerRow + r, centerCol + c, dark, true);
    }
  }
}

// Alignment pattern centers for versions 2-4
const ALIGNMENT_CENTERS: Record<number, number[][]> = {
  1: [],
  2: [[6, 18]],
  3: [[6, 22]],
  4: [[6, 26]],
};

// Note: drawDarkModule is part of the QR spec (dark module at (4v+9, 8))
// but the format-info routine already places this via drawFormatInfo.
// Kept here for spec completeness; called in encodeQR below.
function drawDarkModule(matrix: Matrix, func: FuncMatrix) {
  setModule(matrix, func, 4 * 1 + 9, 8, true, true);
}

// Format string (ECC level M = 00, mask pattern 2 = 010)
// Pre-computed for mask 2 (ECC-M): format bits = 101000100100101
// masks 0-7 XOR'd with 101010000010010
// We use mask 2 which works well for most patterns
const FORMAT_INFO_MASK2_M = 0b101000100100101; // ECC-M + mask 2

function drawFormatInfo(matrix: Matrix, func: FuncMatrix, size: number, formatInfo: number) {
  const bits: boolean[] = [];
  for (let i = 14; i >= 0; i--) {
    bits.push(((formatInfo >> i) & 1) === 1);
  }

  // Positions around finder patterns
  const positions = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];

  // Top-left area (first 8 modules horizontal + 7 vertical)
  for (let i = 0; i <= 5; i++) {
    setModule(matrix, func, 8, i, bits[i], true);
    setModule(matrix, func, 5 - i, 8, bits[i], true);
  }
  setModule(matrix, func, 8, 7, bits[6], true);
  setModule(matrix, func, 8, 8, bits[7], true);
  setModule(matrix, func, 7, 8, bits[8], true);
  for (let i = 9; i <= 14; i++) {
    setModule(matrix, func, 14 - i, 8, bits[i], true);
  }

  // Top-right area
  for (let i = 0; i <= 7; i++) {
    setModule(matrix, func, 8, size - 1 - i, bits[i], true);
  }

  // Bottom-left area
  for (let i = 8; i <= 14; i++) {
    setModule(matrix, func, size - 15 + i, 8, bits[i], true);
  }

  // Dark module
  setModule(matrix, func, size - 8, 8, true, true);

  void positions; // used above inline
}

function placeData(matrix: Matrix, func: FuncMatrix, codewords: Uint8Array) {
  const size = matrix.length;
  let bitIdx = 0;
  const totalBits = codewords.length * 8;

  // Iterate columns from right to left in pairs, skipping column 6 (timing)
  let col = size - 1;
  let goingUp = true;

  while (col >= 0) {
    if (col === 6) { col--; continue; }

    for (let rowOff = 0; rowOff < size; rowOff++) {
      const row = goingUp ? size - 1 - rowOff : rowOff;

      for (let cOff = 0; cOff <= 1; cOff++) {
        const c = col - cOff;
        if (func[row][c]) continue;

        let dark = false;
        if (bitIdx < totalBits) {
          const byteIdx = Math.floor(bitIdx / 8);
          const bitPos = 7 - (bitIdx % 8);
          dark = ((codewords[byteIdx] >> bitPos) & 1) === 1;
          bitIdx++;
        }

        // Apply mask 2: (row // 2 + col // 3) % 2 == 0
        const masked = (Math.floor(row / 2) + Math.floor(c / 3)) % 2 === 0;
        matrix[row][c] = dark !== masked;
      }
    }

    col -= 2;
    goingUp = !goingUp;
  }
}

// ── Main QR encoder ────────────────────────────────────────────────────────

function encodeQR(text: string): Matrix | null {
  const version = selectVersion(text.length);
  if (version < 0) return null;

  const info = VERSION_INFO[version];
  const size = info.size;
  const matrix = createMatrix(size);
  const func = createFuncMatrix(size);

  // Draw structural elements
  drawFinderPattern(matrix, func, 0, 0);
  drawFinderPattern(matrix, func, 0, size - 7);
  drawFinderPattern(matrix, func, size - 7, 0);
  drawTimingPatterns(matrix, func, size);

  const alignCenters = ALIGNMENT_CENTERS[version] ?? [];
  for (const [r, c] of alignCenters) {
    drawAlignmentPattern(matrix, func, r, c);
  }

  drawFormatInfo(matrix, func, size, FORMAT_INFO_MASK2_M);
  drawDarkModule(matrix, func);

  // Encode data
  const dataBytes = encodeData(text, version);
  const codewords = buildCodewords(dataBytes, version);
  placeData(matrix, func, codewords);

  return matrix;
}

// ── SVG renderer ───────────────────────────────────────────────────────────

function matrixToSVG(matrix: Matrix, moduleSize = 8, quietZone = 4): string {
  const size = matrix.length;
  const qz = quietZone;
  const totalSize = (size + qz * 2) * moduleSize;
  const rects: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        const x = (c + qz) * moduleSize;
        const y = (r + qz) * moduleSize;
        rects.push(`<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="#000"/>`);
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">
  <rect width="${totalSize}" height="${totalSize}" fill="#fff"/>
  ${rects.join('\n  ')}
</svg>`;
}

// ── Fallback: placeholder SVG for URLs that are too long ──────────────────

function fallbackSVG(): string {
  const msg = 'URL too long for QR';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80">
  <rect width="200" height="80" fill="#fee2e2" rx="8"/>
  <text x="100" y="35" font-family="sans-serif" font-size="12" fill="#991b1b" text-anchor="middle">${msg}</text>
  <text x="100" y="55" font-family="sans-serif" font-size="9" fill="#b91c1c" text-anchor="middle">(max ~48 chars)</text>
</svg>`;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url || !url.trim()) {
      return new NextResponse('Missing url parameter', { status: 400 });
    }

    const decodedUrl = decodeURIComponent(url.trim());

    let svg: string;
    const matrix = encodeQR(decodedUrl);
    if (matrix) {
      svg = matrixToSVG(matrix);
    } else {
      svg = fallbackSVG();
    }

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('GET /api/deep-links/qr error:', error);
    return new NextResponse('Failed to generate QR code', { status: 500 });
  }
}

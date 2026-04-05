/**
 * テスト用アセット生成スクリプト
 * - キャラクター/NPC/敵スプライト (PNG)
 * - タイルセット (PNG)
 * - BGM (WAV)
 *
 * 使い方: node tools/generate-test-assets.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'assets');

// ===== PNG生成ユーティリティ =====

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createPngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  const crcNum = crc32(crcData);
  crcVal[0] = (crcNum >>> 24) & 0xFF;
  crcVal[1] = (crcNum >>> 16) & 0xFF;
  crcVal[2] = (crcNum >>> 8) & 0xFF;
  crcVal[3] = crcNum & 0xFF;
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function createPng(width, height, pixels) {
  // pixels: Uint8Array of RGBA values (width * height * 4)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT - raw pixel data with filter bytes
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rawData.push(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
    }
  }

  // Simple deflate (store blocks, no compression)
  const raw = Buffer.from(rawData);
  const deflateBlocks = [];
  const BLOCK_SIZE = 65535;
  for (let i = 0; i < raw.length; i += BLOCK_SIZE) {
    const block = raw.subarray(i, Math.min(i + BLOCK_SIZE, raw.length));
    const isLast = (i + BLOCK_SIZE >= raw.length) ? 1 : 0;
    const header = Buffer.alloc(5);
    header[0] = isLast;
    header.writeUInt16LE(block.length, 1);
    header.writeUInt16LE(block.length ^ 0xFFFF, 3);
    deflateBlocks.push(header, block);
  }

  // zlib wrapper
  const zlibHeader = Buffer.from([0x78, 0x01]); // CMF, FLG
  const deflateData = Buffer.concat(deflateBlocks);

  // Adler32
  let s1 = 1, s2 = 0;
  for (let i = 0; i < raw.length; i++) {
    s1 = (s1 + raw[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = Buffer.alloc(4);
  const adlerVal = (s2 << 16) | s1;
  adler[0] = (adlerVal >>> 24) & 0xFF;
  adler[1] = (adlerVal >>> 16) & 0xFF;
  adler[2] = (adlerVal >>> 8) & 0xFF;
  adler[3] = adlerVal & 0xFF;

  const idatData = Buffer.concat([zlibHeader, deflateData, adler]);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', idatData),
    createPngChunk('IEND', iend),
  ]);
}

// ===== スプライト描画ヘルパー =====

function fillRect(pixels, pw, x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const i = ((y + dy) * pw + (x + dx)) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
}

function drawCharacterSprite(color) {
  // 48x64 = 3列x4行 の16x16フレーム
  const w = 48, h = 64;
  const pixels = new Uint8Array(w * h * 4); // 透明で初期化

  const [r, g, b] = color;
  const directions = [
    [0, 1], // 下 (row 0) - 目を下に
    [1, 0], // 左 (row 1)
    [-1, 0], // 右 (row 2)
    [0, -1], // 上 (row 3) - 目なし
  ];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const ox = col * 16;
      const oy = row * 16;

      // 体 (8x12, 中央)
      fillRect(pixels, w, ox + 4, oy + 2, 8, 12, r, g, b);

      // 頭 (明るめ)
      const hr = Math.min(255, r + 40);
      const hg = Math.min(255, g + 40);
      const hb = Math.min(255, b + 40);
      fillRect(pixels, w, ox + 5, oy + 1, 6, 5, hr, hg, hb);

      // 足 (暗め) - 歩行アニメ
      const fr = Math.max(0, r - 40);
      const fg = Math.max(0, g - 40);
      const fb = Math.max(0, b - 40);
      if (col === 0) {
        // 中立
        fillRect(pixels, w, ox + 5, oy + 12, 2, 3, fr, fg, fb);
        fillRect(pixels, w, ox + 9, oy + 12, 2, 3, fr, fg, fb);
      } else if (col === 1) {
        // 左足前
        fillRect(pixels, w, ox + 4, oy + 12, 2, 3, fr, fg, fb);
        fillRect(pixels, w, ox + 9, oy + 12, 2, 3, fr, fg, fb);
      } else {
        // 右足前
        fillRect(pixels, w, ox + 5, oy + 12, 2, 3, fr, fg, fb);
        fillRect(pixels, w, ox + 10, oy + 12, 2, 3, fr, fg, fb);
      }

      // 目 (下/左/右向きのみ)
      if (row === 0) {
        // 下向き - 正面の目
        fillRect(pixels, w, ox + 6, oy + 3, 1, 1, 0, 0, 0);
        fillRect(pixels, w, ox + 9, oy + 3, 1, 1, 0, 0, 0);
      } else if (row === 1) {
        // 左向き
        fillRect(pixels, w, ox + 5, oy + 3, 1, 1, 0, 0, 0);
      } else if (row === 2) {
        // 右向き
        fillRect(pixels, w, ox + 10, oy + 3, 1, 1, 0, 0, 0);
      }
    }
  }

  return createPng(w, h, pixels);
}

function drawEnemySprite(color, shape = 'blob') {
  const w = 64, h = 64;
  const pixels = new Uint8Array(w * h * 4);
  const [r, g, b] = color;

  if (shape === 'blob') {
    // スライム風の丸い形
    const cx = 32, cy = 36, rx = 20, ry = 16;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          const i = (y * w + x) * 4;
          // グラデーション
          const shade = 1 - dy * 0.3;
          pixels[i] = Math.min(255, Math.floor(r * shade));
          pixels[i + 1] = Math.min(255, Math.floor(g * shade));
          pixels[i + 2] = Math.min(255, Math.floor(b * shade));
          pixels[i + 3] = 255;
        }
      }
    }
    // 目
    fillRect(pixels, w, 25, 32, 3, 3, 255, 255, 255);
    fillRect(pixels, w, 36, 32, 3, 3, 255, 255, 255);
    fillRect(pixels, w, 26, 33, 1, 1, 0, 0, 0);
    fillRect(pixels, w, 37, 33, 1, 1, 0, 0, 0);
  } else if (shape === 'bat') {
    // コウモリ風
    fillRect(pixels, w, 28, 24, 8, 12, r, g, b); // 体
    fillRect(pixels, w, 10, 20, 18, 8, r - 30, g - 30, b); // 左翼
    fillRect(pixels, w, 36, 20, 18, 8, r - 30, g - 30, b); // 右翼
    fillRect(pixels, w, 30, 28, 2, 2, 255, 0, 0); // 目
    fillRect(pixels, w, 34, 28, 2, 2, 255, 0, 0);
  } else if (shape === 'skeleton') {
    // がいこつ風
    fillRect(pixels, w, 24, 8, 16, 16, 240, 240, 230); // 頭
    fillRect(pixels, w, 28, 24, 8, 20, 220, 220, 210); // 体
    fillRect(pixels, w, 20, 26, 8, 4, 220, 220, 210); // 左腕
    fillRect(pixels, w, 36, 26, 8, 4, 220, 220, 210); // 右腕
    fillRect(pixels, w, 28, 44, 3, 12, 220, 220, 210); // 左足
    fillRect(pixels, w, 33, 44, 3, 12, 220, 220, 210); // 右足
    fillRect(pixels, w, 27, 14, 3, 3, 0, 0, 0); // 目
    fillRect(pixels, w, 34, 14, 3, 3, 0, 0, 0);
    fillRect(pixels, w, 29, 20, 6, 1, 0, 0, 0); // 口
  } else if (shape === 'humanoid') {
    // ゴブリン風人型
    fillRect(pixels, w, 24, 8, 16, 14, r, g, b); // 頭
    fillRect(pixels, w, 26, 22, 12, 20, r - 20, g - 20, b - 20); // 体
    fillRect(pixels, w, 18, 24, 8, 4, r, g, b); // 左腕
    fillRect(pixels, w, 38, 24, 8, 4, r, g, b); // 右腕
    fillRect(pixels, w, 26, 42, 4, 14, r - 40, g - 40, b - 40); // 左足
    fillRect(pixels, w, 34, 42, 4, 14, r - 40, g - 40, b - 40); // 右足
    fillRect(pixels, w, 27, 14, 3, 3, 255, 0, 0); // 目
    fillRect(pixels, w, 34, 14, 3, 3, 255, 0, 0);
  } else if (shape === 'king') {
    // ボス風 (大きめ人型+王冠)
    fillRect(pixels, w, 22, 12, 20, 16, r, g, b); // 頭
    fillRect(pixels, w, 24, 4, 4, 8, 255, 215, 0); // 王冠左
    fillRect(pixels, w, 30, 2, 4, 10, 255, 215, 0); // 王冠中
    fillRect(pixels, w, 36, 4, 4, 8, 255, 215, 0); // 王冠右
    fillRect(pixels, w, 22, 28, 20, 22, r - 20, g - 20, b - 20); // 体
    fillRect(pixels, w, 12, 30, 10, 6, r, g, b); // 左腕
    fillRect(pixels, w, 42, 30, 10, 6, r, g, b); // 右腕
    fillRect(pixels, w, 24, 50, 6, 12, r - 40, g - 40, b - 40); // 左足
    fillRect(pixels, w, 34, 50, 6, 12, r - 40, g - 40, b - 40); // 右足
    fillRect(pixels, w, 26, 18, 4, 4, 255, 255, 0); // 目
    fillRect(pixels, w, 34, 18, 4, 4, 255, 255, 0);
  }

  return createPng(w, h, pixels);
}

function drawTileset() {
  // 8タイル横 × 1行 = 128x16
  // タイル0=草, 1=道, 2=水, 3=壁, 4=木, 5=屋根, 6=ドア, 7=花
  const tileColors = [
    [34, 139, 34],   // 0: 草 (緑)
    [210, 180, 140], // 1: 道 (ベージュ)
    [30, 100, 200],  // 2: 水 (青)
    [128, 128, 128], // 3: 壁 (灰)
    [0, 100, 0],     // 4: 木 (深緑)
    [139, 69, 19],   // 5: 屋根 (茶)
    [160, 82, 45],   // 6: ドア (薄茶)
    [255, 105, 180], // 7: 花 (ピンク)
  ];

  const w = 128, h = 16;
  const pixels = new Uint8Array(w * h * 4);

  for (let ti = 0; ti < 8; ti++) {
    const [r, g, b] = tileColors[ti];
    const ox = ti * 16;

    // ベース色で塗る
    fillRect(pixels, w, ox, 0, 16, 16, r, g, b, 255);

    // テクスチャ感を出す - 少しノイズを入れる
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = (y * w + ox + x) * 4;
        const noise = ((x * 7 + y * 13) % 5) * 4 - 8;
        pixels[i] = Math.max(0, Math.min(255, r + noise));
        pixels[i + 1] = Math.max(0, Math.min(255, g + noise));
        pixels[i + 2] = Math.max(0, Math.min(255, b + noise));
        pixels[i + 3] = 255;
      }
    }

    // 境界線 (1px暗い枠)
    for (let x = 0; x < 16; x++) {
      const topI = (0 * w + ox + x) * 4;
      const botI = (15 * w + ox + x) * 4;
      pixels[topI] = Math.floor(r * 0.7); pixels[topI + 1] = Math.floor(g * 0.7); pixels[topI + 2] = Math.floor(b * 0.7);
      pixels[botI] = Math.floor(r * 0.7); pixels[botI + 1] = Math.floor(g * 0.7); pixels[botI + 2] = Math.floor(b * 0.7);
    }
    for (let y = 0; y < 16; y++) {
      const leftI = (y * w + ox) * 4;
      const rightI = (y * w + ox + 15) * 4;
      pixels[leftI] = Math.floor(r * 0.7); pixels[leftI + 1] = Math.floor(g * 0.7); pixels[leftI + 2] = Math.floor(b * 0.7);
      pixels[rightI] = Math.floor(r * 0.7); pixels[rightI + 1] = Math.floor(g * 0.7); pixels[rightI + 2] = Math.floor(b * 0.7);
    }
  }

  return createPng(w, h, pixels);
}

// ===== WAV生成 =====

function createWav(durationSec, frequency, sampleRate = 22050, volume = 0.3) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2; // 16bit mono

  const buf = Buffer.alloc(44 + dataSize);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);

  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  // シンプルなメロディを生成
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // メインの音 + ハーモニクス
    let sample = Math.sin(2 * Math.PI * frequency * t) * 0.6;
    sample += Math.sin(2 * Math.PI * frequency * 1.5 * t) * 0.2;
    sample += Math.sin(2 * Math.PI * frequency * 2 * t) * 0.1;

    // ゆっくりしたビブラート
    sample *= 1 + 0.1 * Math.sin(2 * Math.PI * 4 * t);

    // メロディ: 4拍子で音程変化
    const beat = Math.floor(t * 2) % 8;
    const melodyMult = [1, 1.125, 1.25, 1.125, 1, 0.875, 1, 1.25][beat];
    sample = Math.sin(2 * Math.PI * frequency * melodyMult * t) * 0.5;
    sample += Math.sin(2 * Math.PI * frequency * melodyMult * 0.5 * t) * 0.3;

    // フェードイン/アウト
    const fadeIn = Math.min(1, t * 4);
    const fadeOut = Math.min(1, (durationSec - t) * 4);
    sample *= volume * fadeIn * fadeOut;

    const val = Math.max(-1, Math.min(1, sample));
    buf.writeInt16LE(Math.floor(val * 32767), 44 + i * 2);
  }

  return buf;
}

// ===== メイン処理 =====

// ディレクトリ作成
const dirs = [
  'sprites/characters',
  'sprites/enemies',
  'sprites/tilesets',
  'audio/bgm',
  'audio/se',
];
for (const d of dirs) {
  mkdirSync(join(ASSETS, d), { recursive: true });
}

// キャラクタースプライト
const characters = {
  hero: [0, 120, 255],     // 青 (勇者)
  elna: [255, 180, 200],   // ピンク (ヒーラー)
};
for (const [id, color] of Object.entries(characters)) {
  const png = drawCharacterSprite(color);
  writeFileSync(join(ASSETS, `sprites/characters/${id}.png`), png);
  console.log(`✓ sprites/characters/${id}.png`);
}

// NPCスプライト
const npcs = {
  elder: [180, 130, 70],     // 茶 (長老)
  shopkeeper: [200, 160, 60],// 黄土 (店主)
  innkeeper: [160, 100, 60], // 茶 (宿屋)
  priest: [240, 240, 220],   // 白 (神父)
  villager: [120, 160, 100], // 緑系 (村人)
  soldier: [100, 100, 140],  // 灰青 (兵士)
};
for (const [id, color] of Object.entries(npcs)) {
  const png = drawCharacterSprite(color);
  writeFileSync(join(ASSETS, `sprites/characters/${id}.png`), png);
  console.log(`✓ sprites/characters/${id}.png`);
}

// 敵スプライト
const enemies = [
  { id: 'slime', color: [100, 200, 255], shape: 'blob' },
  { id: 'bat', color: [100, 50, 120], shape: 'bat' },
  { id: 'skeleton', color: [240, 240, 230], shape: 'skeleton' },
  { id: 'goblin', color: [80, 160, 60], shape: 'humanoid' },
  { id: 'goblin_archer', color: [60, 140, 40], shape: 'humanoid' },
  { id: 'goblin_king', color: [120, 180, 80], shape: 'king' },
];
for (const { id, color, shape } of enemies) {
  const png = drawEnemySprite(color, shape);
  writeFileSync(join(ASSETS, `sprites/enemies/${id}.png`), png);
  console.log(`✓ sprites/enemies/${id}.png`);
}

// タイルセット
const tileset = drawTileset();
writeFileSync(join(ASSETS, 'sprites/tilesets/village.png'), tileset);
console.log('✓ sprites/tilesets/village.png');

// BGM (WAVファイル、各5秒ループ)
const bgms = {
  village: { freq: 330, dur: 6 },   // 明るいE4
  field: { freq: 294, dur: 6 },     // D4
  dungeon: { freq: 220, dur: 6 },   // 暗いA3
  battle: { freq: 392, dur: 4 },    // 激しいG4
};
for (const [id, { freq, dur }] of Object.entries(bgms)) {
  const wav = createWav(dur, freq);
  writeFileSync(join(ASSETS, `audio/bgm/${id}.wav`), wav);
  console.log(`✓ audio/bgm/${id}.wav`);
}

console.log('\n✅ テスト用アセット生成完了!');
console.log('注意: AudioManagerをWAV対応に更新する必要があります。');

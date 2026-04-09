/**
 * チップチューンBGM生成ツール
 * - title.wav / victory.wav を生成
 * 実行: npx tsx tools/generate-bgm.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_RATE = 22050;
const OUTPUT_DIR = path.resolve(__dirname, '../assets/audio/bgm');

// ---- 波形生成 ----

function squareWave(phase: number): number {
  return phase % 1 < 0.5 ? 1 : -1;
}

function triangleWave(phase: number): number {
  const p = phase % 1;
  return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
}

function sineWave(phase: number): number {
  return Math.sin(phase * Math.PI * 2);
}

function noise(): number {
  return Math.random() * 2 - 1;
}

type WaveType = 'square' | 'triangle' | 'sine' | 'noise';

function getWave(type: WaveType, phase: number): number {
  switch (type) {
    case 'square': return squareWave(phase);
    case 'triangle': return triangleWave(phase);
    case 'sine': return sineWave(phase);
    case 'noise': return noise();
  }
}

// ---- 音符定義 ----

// 音名→周波数
const NOTE_FREQ: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50,
  REST: 0,
};

interface Note {
  freq: number;
  duration: number; // 秒
}

function parseNotes(notation: string, bpm: number): Note[] {
  const beatDuration = 60 / bpm;
  const notes: Note[] = [];

  const tokens = notation.trim().split(/\s+/);
  for (const token of tokens) {
    const match = token.match(/^([A-Gb#]+\d|REST)([\d.]+)?$/);
    if (!match) continue;
    const noteName = match[1];
    const beats = parseFloat(match[2] || '1');
    const freq = NOTE_FREQ[noteName] ?? 0;
    notes.push({ freq, duration: beatDuration * beats });
  }
  return notes;
}

// ---- トラック合成 ----

interface Track {
  wave: WaveType;
  volume: number;
  notes: Note[];
}

function renderTrack(track: Track, totalSamples: number): Float32Array {
  const buffer = new Float32Array(totalSamples);
  let samplePos = 0;
  let phase = 0;

  for (const note of track.notes) {
    const noteSamples = Math.floor(note.duration * SAMPLE_RATE);
    const endPos = Math.min(samplePos + noteSamples, totalSamples);

    for (let i = samplePos; i < endPos; i++) {
      if (note.freq === 0) {
        buffer[i] = 0;
      } else {
        const noteProgress = (i - samplePos) / noteSamples;
        // エンベロープ: アタック + ディケイ + リリース
        let envelope = 1;
        if (noteProgress < 0.02) {
          envelope = noteProgress / 0.02; // アタック
        } else if (noteProgress > 0.85) {
          envelope = (1 - noteProgress) / 0.15; // リリース
        }

        const sample = getWave(track.wave, phase) * track.volume * envelope;
        buffer[i] = sample;
        phase += note.freq / SAMPLE_RATE;
      }
    }
    samplePos = endPos;
  }

  return buffer;
}

function mixTracks(tracks: Float32Array[]): Float32Array {
  const len = Math.max(...tracks.map(t => t.length));
  const mixed = new Float32Array(len);
  for (const track of tracks) {
    for (let i = 0; i < track.length; i++) {
      mixed[i] += track[i];
    }
  }
  // ノーマライズ
  let peak = 0;
  for (let i = 0; i < mixed.length; i++) {
    peak = Math.max(peak, Math.abs(mixed[i]));
  }
  if (peak > 0) {
    const scale = 0.9 / peak;
    for (let i = 0; i < mixed.length; i++) {
      mixed[i] *= scale;
    }
  }
  return mixed;
}

// ---- WAV書き出し ----

function writeWav(filePath: string, samples: Float32Array): void {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    const int16 = Math.floor(val * 32767);
    buffer.writeInt16LE(int16, headerSize + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// ---- タイトルBGM ----

function generateTitleBgm(): void {
  const bpm = 108;

  // メインメロディ（矩形波）- DQ風の荘厳なテーマ
  const melodyNotation = `
    REST2
    C5.1 E5.1 G5.1 C6.2 B5.1
    A5.1 G5.2 E5.1 F5.1
    G5.2 E5.1 D5.1 C5.2
    REST1 D5.1
    E5.1 G5.1 A5.1 G5.2 E5.1
    D5.1 C5.2 D5.1 E5.1
    C5.3 REST1
    REST2
    C5.1 E5.1 G5.1 C6.2 B5.1
    A5.1 G5.2 E5.1 F5.1
    G5.2 E5.1 D5.1 C5.2
    REST1 D5.1
    E5.1 G5.1 A5.1 G5.2 E5.1
    D5.1 C5.2 D5.1 E5.1
    C5.3 REST1
  `;

  // ベースライン（三角波）
  const bassNotation = `
    REST2
    C3.2 C3.2 E3.2
    F3.2 F3.2 C3.2
    G3.2 G3.2 C3.2
    G3.2 G3.2
    C3.2 C3.2 A3.2
    G3.2 G3.2 G3.2
    C3.4 REST2
    C3.2 C3.2 E3.2
    F3.2 F3.2 C3.2
    G3.2 G3.2 C3.2
    G3.2 G3.2
    C3.2 C3.2 A3.2
    G3.2 G3.2 G3.2
    C3.4 REST2
  `;

  // ハーモニー（矩形波、小さめ）
  const harmonyNotation = `
    REST2
    E4.1 G4.1 B4.1 E5.2 D5.1
    C5.1 E5.2 C5.1 A4.1
    B4.2 G4.1 F4.1 E4.2
    REST1 F4.1
    G4.1 B4.1 C5.1 B4.2 G4.1
    F4.1 E4.2 F4.1 G4.1
    E4.3 REST1
    REST2
    E4.1 G4.1 B4.1 E5.2 D5.1
    C5.1 E5.2 C5.1 A4.1
    B4.2 G4.1 F4.1 E4.2
    REST1 F4.1
    G4.1 B4.1 C5.1 B4.2 G4.1
    F4.1 E4.2 F4.1 G4.1
    E4.3 REST1
  `;

  const melodyNotes = parseNotes(melodyNotation, bpm);
  const bassNotes = parseNotes(bassNotation, bpm);
  const harmonyNotes = parseNotes(harmonyNotation, bpm);

  const totalDuration = melodyNotes.reduce((sum, n) => sum + n.duration, 0);
  const totalSamples = Math.floor(totalDuration * SAMPLE_RATE);

  const tracks = [
    renderTrack({ wave: 'square', volume: 0.35, notes: melodyNotes }, totalSamples),
    renderTrack({ wave: 'triangle', volume: 0.45, notes: bassNotes }, totalSamples),
    renderTrack({ wave: 'square', volume: 0.15, notes: harmonyNotes }, totalSamples),
  ];

  const mixed = mixTracks(tracks);
  writeWav(path.join(OUTPUT_DIR, 'title.wav'), mixed);
}

// ---- 勝利ファンファーレBGM ----

function generateVictoryBgm(): void {
  const bpm = 140;

  // DQ風勝利ファンファーレ
  const melodyNotation = `
    C5.0.5 C5.0.5 C5.0.5 C5.1.5
    Bb4.1 C5.1 D5.1 C5.0.5 D5.0.5
    E5.2 C5.1
    D5.1 E5.1 D5.0.5 C5.0.5
    D5.1 E5.1 F5.1 E5.0.5 D5.0.5
    C5.1 D5.1 C5.2
    REST1
    E5.0.5 E5.0.5 E5.0.5 E5.1.5
    D5.1 E5.1 F5.1 E5.0.5 F5.0.5
    G5.2 E5.1
    F5.1 G5.1 A5.1 G5.0.5 F5.0.5
    E5.1 F5.1 E5.1 D5.1
    C5.3 REST1
  `;

  const bassNotation = `
    C3.2 C3.2
    F3.2 G3.2
    C4.2 C3.2
    G3.2 G3.2
    G3.2 A3.2
    G3.2 C3.2
    REST1
    C3.2 C3.2
    F3.2 G3.2
    C4.2 C3.2
    F3.2 F3.2
    G3.2 G3.2
    C3.3 REST1
  `;

  const melodyNotes = parseNotes(melodyNotation, bpm);
  const bassNotes = parseNotes(bassNotation, bpm);

  const totalDuration = melodyNotes.reduce((sum, n) => sum + n.duration, 0);
  const totalSamples = Math.floor(totalDuration * SAMPLE_RATE);

  const tracks = [
    renderTrack({ wave: 'square', volume: 0.4, notes: melodyNotes }, totalSamples),
    renderTrack({ wave: 'triangle', volume: 0.5, notes: bassNotes }, totalSamples),
  ];

  const mixed = mixTracks(tracks);
  writeWav(path.join(OUTPUT_DIR, 'victory.wav'), mixed);
}

// ---- 既存BGMの改善版生成 ----

function generateBattleBgm(): void {
  const bpm = 160;

  // 激しいバトルテーマ
  const melodyNotation = `
    E5.0.5 E5.0.5 E5.0.5 REST0.5
    E5.0.5 D5.0.5 C5.0.5 D5.0.5
    E5.1 G5.1
    A5.0.5 G5.0.5 E5.0.5 D5.0.5
    C5.1 D5.1
    E5.0.5 E5.0.5 E5.0.5 REST0.5
    E5.0.5 F5.0.5 G5.0.5 A5.0.5
    G5.1 E5.1
    D5.0.5 E5.0.5 D5.0.5 C5.0.5
    D5.2
    REST0.5 A4.0.5 B4.0.5 C5.0.5
    D5.0.5 E5.0.5 F5.0.5 G5.0.5
    A5.1 G5.1
    F5.0.5 E5.0.5 D5.0.5 C5.0.5
    D5.1 E5.1
    C5.2
  `;

  const bassNotation = `
    A3.1 A3.1 A3.1 A3.1
    A3.1 C4.1
    F3.1 F3.1
    G3.1 G3.1
    A3.1 A3.1 A3.1 A3.1
    A3.1 C4.1
    G3.1 G3.1
    G3.1 G3.1
    F3.1 F3.1
    F3.1 F3.1
    A3.1 C4.1
    F3.1 F3.1
    G3.1 G3.1
    A3.2
  `;

  const melodyNotes = parseNotes(melodyNotation, bpm);
  const bassNotes = parseNotes(bassNotation, bpm);

  const totalDuration = melodyNotes.reduce((sum, n) => sum + n.duration, 0);
  const totalSamples = Math.floor(totalDuration * SAMPLE_RATE);

  const tracks = [
    renderTrack({ wave: 'square', volume: 0.35, notes: melodyNotes }, totalSamples),
    renderTrack({ wave: 'triangle', volume: 0.5, notes: bassNotes }, totalSamples),
  ];

  const mixed = mixTracks(tracks);
  writeWav(path.join(OUTPUT_DIR, 'battle.wav'), mixed);
}

function generateVillageBgm(): void {
  const bpm = 90;

  // 穏やかな村のテーマ
  const melodyNotation = `
    REST2
    C5.1 E5.1 G5.2
    A5.1 G5.1 E5.1 D5.1
    C5.2 D5.1 E5.1
    D5.2 REST2
    E5.1 G5.1 A5.2
    G5.1 E5.1 D5.1 C5.1
    D5.2 C5.2
    REST2
    C5.1 E5.1 G5.2
    A5.1 G5.1 E5.1 D5.1
    C5.2 D5.1 E5.1
    D5.2 REST2
    E5.1 G5.1 A5.2
    G5.1 E5.1 D5.1 C5.1
    C5.4
  `;

  const bassNotation = `
    REST2
    C3.2 E3.2
    F3.2 G3.2
    C3.2 G3.2
    G3.2 REST2
    C3.2 F3.2
    E3.2 A3.2
    G3.2 C3.2
    REST2
    C3.2 E3.2
    F3.2 G3.2
    C3.2 G3.2
    G3.2 REST2
    C3.2 F3.2
    E3.2 A3.2
    C3.4
  `;

  const melodyNotes = parseNotes(melodyNotation, bpm);
  const bassNotes = parseNotes(bassNotation, bpm);

  const totalDuration = melodyNotes.reduce((sum, n) => sum + n.duration, 0);
  const totalSamples = Math.floor(totalDuration * SAMPLE_RATE);

  const tracks = [
    renderTrack({ wave: 'triangle', volume: 0.4, notes: melodyNotes }, totalSamples),
    renderTrack({ wave: 'sine', volume: 0.35, notes: bassNotes }, totalSamples),
  ];

  const mixed = mixTracks(tracks);
  writeWav(path.join(OUTPUT_DIR, 'village.wav'), mixed);
}

function generateFieldBgm(): void {
  const bpm = 120;

  // 冒険感のあるフィールドテーマ
  const melodyNotation = `
    C5.1 D5.1 E5.1 G5.1
    A5.2 G5.1 E5.1
    F5.1 E5.1 D5.1 C5.1
    D5.2 REST1 G4.1
    A4.1 B4.1 C5.1 D5.1
    E5.2 D5.1 C5.1
    D5.1 C5.1 B4.1 A4.1
    G4.2 REST2
    C5.1 D5.1 E5.1 G5.1
    A5.2 G5.1 E5.1
    F5.1 E5.1 D5.1 C5.1
    D5.2 REST1 E5.1
    F5.1 E5.1 D5.1 E5.1
    C5.2 D5.1 E5.1
    C5.4
    REST2
  `;

  const bassNotation = `
    C3.2 C3.2
    F3.2 C3.2
    D3.2 A3.2
    G3.2 G3.2
    A3.2 A3.2
    C3.2 A3.2
    G3.2 G3.2
    G3.2 REST2
    C3.2 C3.2
    F3.2 C3.2
    D3.2 A3.2
    G3.2 G3.2
    F3.2 F3.2
    C3.2 G3.2
    C3.4
    REST2
  `;

  const melodyNotes = parseNotes(melodyNotation, bpm);
  const bassNotes = parseNotes(bassNotation, bpm);

  const totalDuration = melodyNotes.reduce((sum, n) => sum + n.duration, 0);
  const totalSamples = Math.floor(totalDuration * SAMPLE_RATE);

  const tracks = [
    renderTrack({ wave: 'square', volume: 0.3, notes: melodyNotes }, totalSamples),
    renderTrack({ wave: 'triangle', volume: 0.45, notes: bassNotes }, totalSamples),
  ];

  const mixed = mixTracks(tracks);
  writeWav(path.join(OUTPUT_DIR, 'field.wav'), mixed);
}

function generateDungeonBgm(): void {
  const bpm = 80;

  // ダークで緊張感のあるダンジョンテーマ
  const melodyNotation = `
    REST2
    E4.2 REST1 E4.1
    F4.1 E4.1 D4.1 C4.1
    D4.2 REST2
    E4.2 REST1 E4.1
    G4.1 F4.1 E4.1 D4.1
    E4.2 REST2
    A4.2 REST1 A4.1
    G4.1 F4.1 E4.1 D4.1
    C4.2 D4.1 E4.1
    D4.2 REST2
    E4.2 REST1 E4.1
    F4.1 E4.1 D4.1 C4.1
    D4.2 REST2
    E4.2 REST1 E4.1
    G4.1 F4.1 E4.1 D4.1
    E4.4
  `;

  const bassNotation = `
    REST2
    A3.2 A3.2
    D3.2 A3.2
    G3.2 REST2
    A3.2 A3.2
    C3.2 G3.2
    A3.2 REST2
    F3.2 F3.2
    E3.2 D3.2
    C3.2 G3.2
    G3.2 REST2
    A3.2 A3.2
    D3.2 A3.2
    G3.2 REST2
    A3.2 A3.2
    C3.2 G3.2
    A3.4
  `;

  const melodyNotes = parseNotes(melodyNotation, bpm);
  const bassNotes = parseNotes(bassNotation, bpm);

  const totalDuration = melodyNotes.reduce((sum, n) => sum + n.duration, 0);
  const totalSamples = Math.floor(totalDuration * SAMPLE_RATE);

  const tracks = [
    renderTrack({ wave: 'square', volume: 0.25, notes: melodyNotes }, totalSamples),
    renderTrack({ wave: 'triangle', volume: 0.4, notes: bassNotes }, totalSamples),
  ];

  const mixed = mixTracks(tracks);
  writeWav(path.join(OUTPUT_DIR, 'dungeon.wav'), mixed);
}

// ---- メイン実行 ----

console.log('Generating BGM files...');
generateTitleBgm();
generateVictoryBgm();
generateBattleBgm();
generateVillageBgm();
generateFieldBgm();
generateDungeonBgm();
console.log('Done!');

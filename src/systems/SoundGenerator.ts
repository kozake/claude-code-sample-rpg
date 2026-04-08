import { Howler } from 'howler';

/**
 * レトロ8bit風サウンドエフェクト生成
 * - Web Audio APIで矩形波/三角波/ノイズを合成
 * - ファイル不要でSEを再生
 */
export class SoundGenerator {
  private volume = 0.5;

  private getContext(): AudioContext | null {
    const ctx = Howler.ctx as AudioContext | undefined;
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /** SE再生（id指定） */
  play(id: string): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const fn = this.sounds[id];
    if (fn) fn(ctx, this.volume);
  }

  // ---- サウンド定義 ----

  private sounds: Record<string, (ctx: AudioContext, vol: number) => void> = {
    /** カーソル移動 */
    cursor: (ctx, vol) => {
      this.playTone(ctx, 'square', 880, 0.04, vol * 0.25);
    },

    /** 決定 */
    confirm: (ctx, vol) => {
      const t = ctx.currentTime;
      this.playTone(ctx, 'square', 523, 0.07, vol * 0.3, t);
      this.playTone(ctx, 'square', 659, 0.07, vol * 0.3, t + 0.07);
      this.playTone(ctx, 'square', 784, 0.1, vol * 0.3, t + 0.14);
    },

    /** キャンセル */
    cancel: (ctx, vol) => {
      const t = ctx.currentTime;
      this.playTone(ctx, 'square', 440, 0.06, vol * 0.25, t);
      this.playTone(ctx, 'square', 330, 0.08, vol * 0.25, t + 0.06);
    },

    /** 物理攻撃 */
    attack: (ctx, vol) => {
      this.playNoise(ctx, 0.12, vol * 0.35, 2000);
      this.playTone(ctx, 'sawtooth', 200, 0.08, vol * 0.2);
    },

    /** クリティカルヒット */
    critical: (ctx, vol) => {
      const t = ctx.currentTime;
      this.playNoise(ctx, 0.2, vol * 0.4, 3000);
      this.playTone(ctx, 'square', 300, 0.05, vol * 0.3, t);
      this.playTone(ctx, 'square', 600, 0.05, vol * 0.3, t + 0.05);
      this.playTone(ctx, 'square', 900, 0.1, vol * 0.35, t + 0.1);
    },

    /** 被ダメージ */
    damage: (ctx, vol) => {
      const t = ctx.currentTime;
      this.playNoise(ctx, 0.1, vol * 0.3, 1500);
      this.playTone(ctx, 'square', 150, 0.12, vol * 0.2, t);
    },

    /** ミス */
    miss: (ctx, vol) => {
      this.playNoise(ctx, 0.06, vol * 0.1, 800);
    },

    /** 回復 */
    heal: (ctx, vol) => {
      const t = ctx.currentTime;
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        this.playTone(ctx, 'sine', freq, 0.12, vol * 0.25, t + i * 0.1);
      });
    },

    /** 敵撃破 */
    enemyDeath: (ctx, vol) => {
      const t = ctx.currentTime;
      this.playNoise(ctx, 0.3, vol * 0.25, 2000);
      this.playTone(ctx, 'square', 400, 0.08, vol * 0.2, t);
      this.playTone(ctx, 'square', 300, 0.08, vol * 0.2, t + 0.08);
      this.playTone(ctx, 'square', 200, 0.15, vol * 0.2, t + 0.16);
    },

    /** レベルアップ */
    levelUp: (ctx, vol) => {
      const t = ctx.currentTime;
      const melody = [523, 587, 659, 784, 880, 1047];
      melody.forEach((freq, i) => {
        this.playTone(ctx, 'square', freq, 0.1, vol * 0.3, t + i * 0.08);
      });
      // 最後の音を伸ばす
      this.playTone(ctx, 'triangle', 1047, 0.4, vol * 0.25, t + melody.length * 0.08);
    },

    /** 逃走 */
    flee: (ctx, vol) => {
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        this.playTone(ctx, 'square', 300 + i * 100, 0.04, vol * 0.2, t + i * 0.04);
      }
    },

    /** 勝利ファンファーレ */
    victory: (ctx, vol) => {
      const t = ctx.currentTime;
      // DQ風ファンファーレ（短い版）
      const melody: [number, number][] = [
        [523, 0.15], [523, 0.15], [523, 0.15], [523, 0.4],
        [415, 0.4], [466, 0.4], [523, 0.2], [466, 0.15], [523, 0.6],
      ];
      let time = t;
      for (const [freq, dur] of melody) {
        this.playTone(ctx, 'square', freq, dur * 0.9, vol * 0.3, time);
        this.playTone(ctx, 'triangle', freq * 0.5, dur * 0.9, vol * 0.15, time);
        time += dur;
      }
    },

    /** メニューを開く */
    menuOpen: (ctx, vol) => {
      this.playTone(ctx, 'square', 660, 0.05, vol * 0.2);
      this.playTone(ctx, 'square', 880, 0.05, vol * 0.2, ctx.currentTime + 0.05);
    },

    /** テキスト表示（1文字ずつ） */
    text: (ctx, vol) => {
      this.playTone(ctx, 'square', 600, 0.02, vol * 0.1);
    },

    /** 戦闘開始 */
    battleStart: (ctx, vol) => {
      const t = ctx.currentTime;
      this.playNoise(ctx, 0.4, vol * 0.3, 4000);
      for (let i = 0; i < 3; i++) {
        this.playTone(ctx, 'square', 200 + i * 200, 0.1, vol * 0.25, t + i * 0.12);
      }
    },

    /** ぼうぎょ */
    defend: (ctx, vol) => {
      this.playTone(ctx, 'triangle', 330, 0.15, vol * 0.2);
    },
  };

  // ---- ユーティリティ ----

  private playTone(
    ctx: AudioContext,
    type: OscillatorType,
    freq: number,
    duration: number,
    volume: number,
    startTime?: number
  ): void {
    const t = startTime ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  private playNoise(ctx: AudioContext, duration: number, volume: number, filterFreq: number): void {
    const t = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(t);
    source.stop(t + duration + 0.01);
  }
}

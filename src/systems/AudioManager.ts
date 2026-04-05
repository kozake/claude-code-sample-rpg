import { Howl, Howler } from 'howler';

const BASE = import.meta.env.BASE_URL;

/**
 * オーディオ管理
 * - BGM再生（ループ、フェードイン/アウト）
 * - SE再生
 * - iOS Safari対応（ユーザー操作でアンロック）
 */
export class AudioManager {
  private unlocked = false;
  private currentBgm: Howl | null = null;
  private currentBgmId = '';
  private bgmVolume = 0.5;
  private seVolume = 0.7;
  private bgmCache = new Map<string, Howl>();
  private seCache = new Map<string, Howl>();

  /** iOS Safari等でオーディオコンテキストをアンロック */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;

    // Howler.jsのctxをresume
    const ctx = Howler.ctx;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  /** BGM再生（同じ曲は再生しない） */
  playBgm(id: string, fadeIn = 1000): void {
    if (id === this.currentBgmId && this.currentBgm?.playing()) return;

    this.stopBgm(500);

    const howl = this.getBgm(id);
    if (!howl) return;

    this.currentBgm = howl;
    this.currentBgmId = id;

    const startPlayback = () => {
      // 別のBGMに切り替わっていたら再生しない
      if (this.currentBgm !== howl) return;
      howl.volume(0);
      howl.play();
      howl.fade(0, this.bgmVolume, fadeIn);
    };

    if (howl.state() === 'loaded') {
      startPlayback();
    } else {
      howl.once('load', startPlayback);
    }
  }

  /** BGM停止 */
  stopBgm(fadeOut = 500): void {
    if (this.currentBgm) {
      const bgm = this.currentBgm;
      bgm.fade(bgm.volume(), 0, fadeOut);
      setTimeout(() => bgm.stop(), fadeOut);
      this.currentBgm = null;
      this.currentBgmId = '';
    }
  }

  /** SE再生 */
  playSe(id: string): void {
    const howl = this.getSe(id);
    if (howl) {
      howl.volume(this.seVolume);
      howl.play();
    }
  }

  /** BGM音量設定 */
  setBgmVolume(vol: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.currentBgm) {
      this.currentBgm.volume(this.bgmVolume);
    }
  }

  /** SE音量設定 */
  setSeVolume(vol: number): void {
    this.seVolume = Math.max(0, Math.min(1, vol));
  }

  private getBgm(id: string): Howl | null {
    if (this.bgmCache.has(id)) return this.bgmCache.get(id)!;

    // BGMファイルが存在する場合のみ生成
    const howl = new Howl({
      src: [`${BASE}assets/audio/bgm/${id}.mp3`, `${BASE}assets/audio/bgm/${id}.ogg`, `${BASE}assets/audio/bgm/${id}.wav`],
      loop: true,
      volume: this.bgmVolume,
      preload: true,
      onloaderror: () => {
        // ファイルが無い場合は静かに失敗
        this.bgmCache.delete(id);
      },
    });
    this.bgmCache.set(id, howl);
    return howl;
  }

  private getSe(id: string): Howl | null {
    if (this.seCache.has(id)) return this.seCache.get(id)!;

    const howl = new Howl({
      src: [`${BASE}assets/audio/se/${id}.mp3`, `${BASE}assets/audio/se/${id}.ogg`, `${BASE}assets/audio/se/${id}.wav`],
      volume: this.seVolume,
      preload: true,
      onloaderror: () => {
        this.seCache.delete(id);
      },
    });
    this.seCache.set(id, howl);
    return howl;
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }
}

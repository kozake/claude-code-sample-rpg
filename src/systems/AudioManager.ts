export class AudioManager {
  private unlocked = false;

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    // Howler.js の AudioContext unlock はタイトル画面の最初のタップで実行
    // Phase 7 で完全実装
  }

  playBgm(_id: string): void {
    // Phase 7 で実装
  }

  stopBgm(): void {
    // Phase 7 で実装
  }

  playSe(_id: string): void {
    // Phase 7 で実装
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }
}

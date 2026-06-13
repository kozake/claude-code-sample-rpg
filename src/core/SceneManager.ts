import { Graphics } from 'pixi.js';
import type { Application } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';
import type { Scene } from './Scene';

export class SceneManager {
  private currentScene: Scene | null = null;
  private app: Application;
  private fadeOverlay: Graphics;

  constructor(app: Application) {
    this.app = app;

    // シーン遷移用の黒フェードオーバーレイ
    this.fadeOverlay = new Graphics();
    this.fadeOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0x000000);
    this.fadeOverlay.alpha = 0;
    this.fadeOverlay.eventMode = 'none';
  }

  async switchTo(scene: Scene): Promise<void> {
    // 前のシーンがある場合はフェードアウトしてから切り替え
    if (this.currentScene) {
      this.app.stage.addChild(this.fadeOverlay);
      await this.fadeTo(1, 150);

      this.currentScene.onExit();
      this.app.stage.removeChild(this.currentScene.container);
    }

    // onEnter完了前にupdateが呼ばれないようnullにする
    this.currentScene = null;
    this.app.stage.addChild(scene.container);

    // オーバーレイを最前面に維持（onEnter中のロードを隠す）
    if (this.fadeOverlay.parent) {
      this.app.stage.setChildIndex(this.fadeOverlay, this.app.stage.children.length - 1);
    }

    await scene.onEnter();
    this.currentScene = scene;

    if (this.fadeOverlay.parent) {
      await this.fadeTo(0, 200);
      this.app.stage.removeChild(this.fadeOverlay);
    }
  }

  /** フェードオーバーレイのalphaをアニメーション */
  private fadeTo(targetAlpha: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startAlpha = this.fadeOverlay.alpha;
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        this.fadeOverlay.alpha = startAlpha + (targetAlpha - startAlpha) * progress;
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  update(delta: number): void {
    this.currentScene?.update(delta);
  }

  get active(): Scene | null {
    return this.currentScene;
  }
}

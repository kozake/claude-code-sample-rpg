import type { Application } from 'pixi.js';
import type { Scene } from './Scene';

export class SceneManager {
  private currentScene: Scene | null = null;
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async switchTo(scene: Scene): Promise<void> {
    if (this.currentScene) {
      this.currentScene.onExit();
      this.app.stage.removeChild(this.currentScene.container);
    }

    // onEnter完了前にupdateが呼ばれないようnullにする
    this.currentScene = null;
    this.app.stage.addChild(scene.container);
    await scene.onEnter();
    this.currentScene = scene;
  }

  update(delta: number): void {
    this.currentScene?.update(delta);
  }

  get active(): Scene | null {
    return this.currentScene;
  }
}

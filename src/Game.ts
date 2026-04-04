import { Application } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';
import { EventBus } from './core/EventBus';
import { SceneManager } from './core/SceneManager';
import { ContentLoader } from './core/ContentLoader';
import { InputManager } from './systems/InputManager';
import { GameState } from './systems/GameState';
import { AudioManager } from './systems/AudioManager';
import { LevelUpSystem } from './systems/LevelUpSystem';
import type { LevelTable } from './data/types';

export class Game {
  readonly app: Application;
  readonly events = new EventBus();
  readonly scenes: SceneManager;
  readonly content = new ContentLoader();
  readonly input = new InputManager();
  readonly state = new GameState();
  readonly audio = new AudioManager();
  readonly levelUp = new LevelUpSystem();

  /** ストーリーフラグ（セーブ/ロード対象） */
  storyFlags: Record<string, boolean | number | string> = {};

  private constructor(app: Application) {
    this.app = app;
    this.scenes = new SceneManager(app);
  }

  static async create(): Promise<Game> {
    const app = new Application();

    await app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 0x000000,
      resolution: 1,
      autoDensity: false,
      antialias: false,
      preference: 'webgl',
    });

    const game = new Game(app);
    await game.content.loadInitial();

    // レベルテーブル読み込み
    const levelTables = await game.content.loadJson<LevelTable[]>('data/level_tables.json');
    if (levelTables) {
      game.levelUp.loadTables(levelTables);
    }

    game.setupScaling();
    game.startGameLoop();

    return game;
  }

  private setupScaling(): void {
    const container = document.getElementById('game-container');
    if (!container) return;

    container.appendChild(this.app.canvas);

    const resize = () => {
      const windowW = window.innerWidth;
      const windowH = window.innerHeight;
      const scaleX = windowW / GAME_WIDTH;
      const scaleY = windowH / GAME_HEIGHT;
      const scale = Math.min(scaleX, scaleY);

      const canvas = this.app.canvas;
      canvas.style.width = `${GAME_WIDTH * scale}px`;
      canvas.style.height = `${GAME_HEIGHT * scale}px`;
    };

    window.addEventListener('resize', resize);
    resize();
  }

  private startGameLoop(): void {
    this.app.ticker.add((ticker) => {
      this.scenes.update(ticker.deltaTime);
    });
  }
}

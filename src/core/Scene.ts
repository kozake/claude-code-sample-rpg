import { Container } from 'pixi.js';
import type { Game } from '../Game';

export abstract class Scene {
  readonly container = new Container();
  protected game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  abstract onEnter(): void | Promise<void>;

  update(_delta: number): void {
    // Override in subclasses
  }

  onExit(): void {
    this.container.removeChildren();
  }
}

import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from '../constants';
import type { Direction } from '../systems/InputManager';

/**
 * マップ上のエンティティ基底クラス
 * - タイル座標ベースの位置管理
 * - スムーズなタイル間移動アニメーション
 */
export class Entity {
  readonly container = new Container();
  protected sprite: Graphics;

  /** 現在のタイル座標 */
  tileX: number;
  tileY: number;

  /** 向いている方向 */
  direction: Direction = 'down';

  /** 移動中フラグ */
  private moving = false;
  private moveProgress = 0;
  private moveFromX = 0;
  private moveFromY = 0;
  private moveToX = 0;
  private moveToY = 0;

  /** 移動速度（フレームあたりの進行率, 1.0で1フレーム移動完了） */
  moveSpeed = 0.08;

  constructor(tileX: number, tileY: number, color: number = 0xffffff) {
    this.tileX = tileX;
    this.tileY = tileY;

    // 仮のスプライト（16x16の矩形）
    this.sprite = new Graphics();
    this.sprite.rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4).fill(color);
    this.container.addChild(this.sprite);

    this.syncPosition();
  }

  /** タイル座標からピクセル座標への即時同期 */
  syncPosition(): void {
    this.container.x = this.tileX * TILE_SIZE;
    this.container.y = this.tileY * TILE_SIZE;
  }

  /** 移動中かどうか */
  get isMoving(): boolean {
    return this.moving;
  }

  /** ピクセル単位の中心座標 */
  get centerX(): number {
    return this.container.x + TILE_SIZE / 2;
  }

  get centerY(): number {
    return this.container.y + TILE_SIZE / 2;
  }

  /** タイル移動を開始 */
  startMove(toX: number, toY: number, dir: Direction): void {
    if (this.moving) return;
    this.moving = true;
    this.moveProgress = 0;
    this.moveFromX = this.tileX;
    this.moveFromY = this.tileY;
    this.moveToX = toX;
    this.moveToY = toY;
    this.tileX = toX;
    this.tileY = toY;
    this.direction = dir;
  }

  /** 毎フレーム更新 */
  update(delta: number): void {
    if (!this.moving) return;

    this.moveProgress += this.moveSpeed * delta;
    if (this.moveProgress >= 1) {
      this.moveProgress = 1;
      this.moving = false;
    }

    // 線形補間
    const x = this.moveFromX + (this.moveToX - this.moveFromX) * this.moveProgress;
    const y = this.moveFromY + (this.moveToY - this.moveFromY) * this.moveProgress;
    this.container.x = Math.round(x * TILE_SIZE);
    this.container.y = Math.round(y * TILE_SIZE);
  }
}

import { Entity } from './Entity';
import { CollisionMap } from '../map/CollisionMap';
import type { Direction } from '../systems/InputManager';
import type { InputManager } from '../systems/InputManager';

const DIR_OFFSET: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * プレイヤーキャラクター
 * - 入力に応じた移動
 * - 衝突判定付き
 */
export class Player extends Entity {
  /** 歩数カウンタ（エンカウント計算用） */
  stepCount = 0;

  constructor(tileX: number, tileY: number) {
    super(tileX, tileY, 0x00ccff); // 青色の仮スプライト
    this.moveSpeed = 0.1;

    // heroスプライトを読み込み
    this.loadSpriteSheet('assets/sprites/characters/hero.png');
  }

  /** 入力と衝突判定を元に移動処理 */
  handleInput(input: InputManager, collision: CollisionMap): void {
    if (this.isMoving) return;

    const dir = input.direction;
    if (!dir) return;

    // 方向転換（移動せず向きだけ変える）
    if (this.direction !== dir) {
      this.direction = dir;
    }

    const { dx, dy } = DIR_OFFSET[dir];
    const nextX = this.tileX + dx;
    const nextY = this.tileY + dy;

    if (collision.isPassable(nextX, nextY)) {
      this.startMove(nextX, nextY, dir);
      this.stepCount++;
    }
  }
}

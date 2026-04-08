import { Container, Graphics, Sprite, Texture, Rectangle, Assets } from 'pixi.js';
import { TILE_SIZE } from '../constants';
import type { Direction } from '../systems/InputManager';

const BASE = import.meta.env.BASE_URL;

/** 方向 → スプライトシートの行インデックス (down=0, left=1, right=2, up=3) */
const DIR_ROW: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

/**
 * マップ上のエンティティ基底クラス
 * - タイル座標ベースの位置管理
 * - スムーズなタイル間移動アニメーション
 * - スプライトシート画像対応（48x64: 3列×4行の16x16フレーム）
 */
export class Entity {
  readonly container = new Container();
  protected fallbackSprite: Graphics | null = null;
  protected imageSprite: Sprite | null = null;
  protected spriteFrames: Texture[][] = []; // [row][col]
  protected animFrame = 0;
  protected animTimer = 0;

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

    // 仮のスプライト（16x16の矩形）- 画像ロード失敗時のフォールバック
    this.fallbackSprite = new Graphics();
    this.fallbackSprite.rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4).fill(color);
    this.container.addChild(this.fallbackSprite);

    this.syncPosition();
  }

  /** スプライトシート画像を読み込み（48x64 = 3列×4行 の16x16フレーム） */
  protected async loadSpriteSheet(path: string): Promise<void> {
    try {
      const url = `${BASE}${path}`;
      const texture: Texture = await Assets.load(url);

      const frameW = 16;
      const frameH = 16;

      this.spriteFrames = [];
      for (let row = 0; row < 4; row++) {
        const rowFrames: Texture[] = [];
        for (let col = 0; col < 3; col++) {
          const frame = new Texture({
            source: texture.source,
            frame: new Rectangle(col * frameW, row * frameH, frameW, frameH),
          });
          rowFrames.push(frame);
        }
        this.spriteFrames.push(rowFrames);
      }

      // 最初のフレームでSpriteを作成（TILE_SIZEに合わせてスケーリング）
      this.imageSprite = new Sprite(this.spriteFrames[0][0]);
      this.imageSprite.width = TILE_SIZE;
      this.imageSprite.height = TILE_SIZE;
      this.container.addChild(this.imageSprite);

      // フォールバックを非表示
      if (this.fallbackSprite) {
        this.fallbackSprite.visible = false;
      }
    } catch {
      // 画像ロード失敗：フォールバックのまま
    }
  }

  /** アニメーションフレームを更新 */
  protected updateAnimation(delta: number): void {
    if (!this.imageSprite || this.spriteFrames.length === 0) return;

    const row = DIR_ROW[this.direction];
    const frames = this.spriteFrames[row];
    if (!frames) return;

    if (this.moving) {
      // 歩行アニメーション: 0→1→0→2 パターン
      this.animTimer += delta;
      if (this.animTimer >= 8) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
      }
      const pattern = [0, 1, 0, 2];
      this.imageSprite.texture = frames[pattern[this.animFrame]];
    } else {
      // 静止時は正面フレーム
      this.imageSprite.texture = frames[0];
      this.animFrame = 0;
      this.animTimer = 0;
    }
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
    if (this.moving) {
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

    this.updateAnimation(delta);
  }
}

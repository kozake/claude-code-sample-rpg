import { Entity } from './Entity';
import type { Direction } from '../systems/InputManager';

/** NPCの色マッピング（フォールバック用） */
const NPC_COLORS: Record<string, number> = {
  elder: 0xffcc00,
  shopkeeper: 0x88cc44,
  innkeeper: 0xcc8844,
  priest: 0xeeeeff,
  villager: 0xccaaff,
};

/**
 * NPCエンティティ
 * - マップ上に表示
 * - 向き固定 or ワンダリング
 */
export class NpcEntity extends Entity {
  readonly npcId: string;
  private wanderRadius: number;
  private originX: number;
  private originY: number;
  private wanderTimer = 0;
  private wanderInterval = 120 + Math.random() * 180; // フレーム

  constructor(npcId: string, tileX: number, tileY: number, direction: Direction, wanderRadius = 0, sprite?: string) {
    const color = NPC_COLORS[sprite ?? ''] ?? 0xccaaff;
    super(tileX, tileY, color);
    this.npcId = npcId;
    this.direction = direction;
    this.wanderRadius = wanderRadius;
    this.originX = tileX;
    this.originY = tileY;
    this.moveSpeed = 0.06;

    // スプライト画像を読み込み
    if (sprite) {
      this.loadSpriteSheet(`assets/sprites/characters/${sprite}.png`);
    }
  }

  /** ワンダリング更新 */
  updateWander(delta: number, isPassable: (x: number, y: number) => boolean): void {
    this.update(delta);

    if (this.wanderRadius <= 0 || this.isMoving) return;

    this.wanderTimer += delta;
    if (this.wanderTimer < this.wanderInterval) return;

    this.wanderTimer = 0;
    this.wanderInterval = 120 + Math.random() * 180;

    // ランダム方向に移動
    const dirs: Direction[] = ['up', 'down', 'left', 'right'];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = offsets[dir];
    const nx = this.tileX + dx;
    const ny = this.tileY + dy;

    // 原点からの距離チェック
    if (Math.abs(nx - this.originX) > this.wanderRadius) return;
    if (Math.abs(ny - this.originY) > this.wanderRadius) return;

    if (isPassable(nx, ny)) {
      this.startMove(nx, ny, dir);
    }
  }
}

import type { MapData } from '../data/types';

/**
 * 衝突判定マップ
 * - collision層の値が1以上なら通行不可
 * - NPC位置も通行不可として扱う
 */
export class CollisionMap {
  private grid: number[][] = [];
  private width = 0;
  private height = 0;
  private npcPositions = new Set<string>();

  load(mapData: MapData): void {
    this.grid = mapData.layers.collision;
    this.height = this.grid.length;
    this.width = this.height > 0 ? this.grid[0].length : 0;

    this.npcPositions.clear();
    if (mapData.npcs) {
      for (const npc of mapData.npcs) {
        this.npcPositions.add(`${npc.x},${npc.y}`);
      }
    }
  }

  /** タイル座標が通行可能かどうか */
  isPassable(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) {
      return false;
    }
    if (this.grid[tileY][tileX] > 0) {
      return false;
    }
    if (this.npcPositions.has(`${tileX},${tileY}`)) {
      return false;
    }
    return true;
  }

  /** NPC位置を更新（ワンダリングNPC用） */
  updateNpcPosition(oldX: number, oldY: number, newX: number, newY: number): void {
    this.npcPositions.delete(`${oldX},${oldY}`);
    this.npcPositions.add(`${newX},${newY}`);
  }

  removeNpc(x: number, y: number): void {
    this.npcPositions.delete(`${x},${y}`);
  }
}

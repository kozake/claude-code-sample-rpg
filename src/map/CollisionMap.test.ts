import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionMap } from './CollisionMap';
import type { MapData } from '../data/types';

/** テスト用の最小MapDataを生成 */
function makeMapData(overrides: Partial<MapData> = {}): MapData {
  return {
    id: 'test_map',
    width: 5,
    height: 5,
    tileSize: 16,
    tileset: 'test',
    layers: {
      ground: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      objects: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      collision: [
        [0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
      ],
    },
    playerStart: { x: 1, y: 1 },
    ...overrides,
  };
}

describe('CollisionMap', () => {
  let cm: CollisionMap;

  beforeEach(() => {
    cm = new CollisionMap();
    cm.load(makeMapData({
      npcs: [
        { id: 'npc1', x: 3, y: 3, direction: 'down' },
      ],
    }));
  });

  // ================================================================
  // isPassable
  // ================================================================
  describe('isPassable', () => {
    it('通行可能タイル → true', () => {
      expect(cm.isPassable(0, 0)).toBe(true);
      expect(cm.isPassable(1, 1)).toBe(true);
    });

    it('通行不可タイル (collision > 0) → false', () => {
      expect(cm.isPassable(4, 0)).toBe(false); // collision[0][4] = 1
      expect(cm.isPassable(2, 2)).toBe(false); // collision[2][2] = 1
      expect(cm.isPassable(0, 4)).toBe(false); // collision[4][0] = 1
    });

    it('マップ外（負の座標） → false', () => {
      expect(cm.isPassable(-1, 0)).toBe(false);
      expect(cm.isPassable(0, -1)).toBe(false);
    });

    it('マップ外（幅/高さ超過） → false', () => {
      expect(cm.isPassable(5, 0)).toBe(false);
      expect(cm.isPassable(0, 5)).toBe(false);
    });

    it('NPC位置 → false', () => {
      expect(cm.isPassable(3, 3)).toBe(false);
    });

    it('NPC位置以外の通行可能タイル → true', () => {
      expect(cm.isPassable(3, 2)).toBe(true);
    });
  });

  // ================================================================
  // updateNpcPosition
  // ================================================================
  describe('updateNpcPosition', () => {
    it('旧位置が通行可能に、新位置が通行不可に', () => {
      expect(cm.isPassable(3, 3)).toBe(false); // NPC元位置
      expect(cm.isPassable(3, 2)).toBe(true);  // 移動先

      cm.updateNpcPosition(3, 3, 3, 2);

      expect(cm.isPassable(3, 3)).toBe(true);  // 元位置は通行可能に
      expect(cm.isPassable(3, 2)).toBe(false); // 新位置は通行不可に
    });
  });

  // ================================================================
  // removeNpc
  // ================================================================
  describe('removeNpc', () => {
    it('NPC除去後に通行可能', () => {
      expect(cm.isPassable(3, 3)).toBe(false);
      cm.removeNpc(3, 3);
      expect(cm.isPassable(3, 3)).toBe(true);
    });

    it('存在しない位置のremoveでもエラーなし', () => {
      expect(() => cm.removeNpc(0, 0)).not.toThrow();
    });
  });

  // ================================================================
  // load
  // ================================================================
  describe('load', () => {
    it('NPCなしマップの読み込み', () => {
      const cm2 = new CollisionMap();
      cm2.load(makeMapData()); // npcs未定義
      expect(cm2.isPassable(0, 0)).toBe(true);
      expect(cm2.isPassable(4, 0)).toBe(false);
    });

    it('再ロードで前のNPC位置がクリアされる', () => {
      expect(cm.isPassable(3, 3)).toBe(false); // NPC位置
      cm.load(makeMapData()); // NPCなしで再ロード
      expect(cm.isPassable(3, 3)).toBe(true);  // クリアされた
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from './GameState';
import type { PartyMember, SaveData } from '../data/types';
import { MAX_PARTY, MAX_ITEM_SLOTS } from '../constants';

/** テスト用パーティメンバー生成 */
function makeMember(overrides: Partial<PartyMember> = {}): PartyMember {
  return {
    id: 'hero',
    name: 'ゆうしゃ',
    class: 'warrior',
    level: 1,
    hp: 30,
    maxHp: 30,
    mp: 5,
    maxMp: 5,
    attack: 20,
    defense: 10,
    speed: 8,
    exp: 0,
    equipment: { weapon: null, armor: null, shield: null, accessory: null },
    spells: [],
    criticalRate: 4,
    dodgeRate: 2,
    statusEffects: [],
    sprite: 'hero',
    joinedByDefault: true,
    removable: true,
    storyLocked: false,
    ...overrides,
  };
}

describe('GameState', () => {
  let state: GameState;

  beforeEach(() => {
    state = new GameState();
  });

  // ================================================================
  // initNewGame
  // ================================================================
  describe('initNewGame', () => {
    it('joinedByDefault=true のメンバーのみactiveに入る', () => {
      const members = [
        makeMember({ id: 'a', joinedByDefault: true }),
        makeMember({ id: 'b', joinedByDefault: false }),
        makeMember({ id: 'c', joinedByDefault: true }),
      ];
      state.initNewGame(members);
      expect(state.active.map((m) => m.id)).toEqual(['a', 'c']);
      expect(state.reserve).toEqual([]);
    });

    it('MAX_PARTY を超えない', () => {
      const members = Array.from({ length: 6 }, (_, i) =>
        makeMember({ id: `m${i}`, joinedByDefault: true })
      );
      state.initNewGame(members);
      expect(state.active).toHaveLength(MAX_PARTY);
    });

    it('状態がリセットされる', () => {
      state.gold = 999;
      state.items = [{ id: 'herb', count: 5 }];
      state.initNewGame([makeMember()]);
      expect(state.gold).toBe(0);
      expect(state.items).toEqual([]);
      expect(state.playTime).toBe(0);
    });
  });

  // ================================================================
  // addMember / removeMember / returnMember
  // ================================================================
  describe('addMember', () => {
    it('active枠に空きがあればactiveに追加', () => {
      state.addMember(makeMember({ id: 'a' }));
      expect(state.active).toHaveLength(1);
      expect(state.active[0].id).toBe('a');
    });

    it('active満員ならreserveに追加', () => {
      for (let i = 0; i < MAX_PARTY; i++) {
        state.addMember(makeMember({ id: `m${i}` }));
      }
      state.addMember(makeMember({ id: 'extra' }));
      expect(state.active).toHaveLength(MAX_PARTY);
      expect(state.reserve).toHaveLength(1);
      expect(state.reserve[0].id).toBe('extra');
    });
  });

  describe('removeMember', () => {
    it('activeからleftへ移動', () => {
      state.addMember(makeMember({ id: 'hero' }));
      const removed = state.removeMember('hero');
      expect(removed?.id).toBe('hero');
      expect(state.active).toHaveLength(0);
      expect(state.left).toHaveLength(1);
    });

    it('reserveからleftへ移動', () => {
      for (let i = 0; i < MAX_PARTY; i++) {
        state.addMember(makeMember({ id: `m${i}` }));
      }
      state.addMember(makeMember({ id: 'reserve1' }));
      const removed = state.removeMember('reserve1');
      expect(removed?.id).toBe('reserve1');
      expect(state.reserve).toHaveLength(0);
      expect(state.left).toHaveLength(1);
    });

    it('存在しないID → null', () => {
      expect(state.removeMember('nonexistent')).toBeNull();
    });
  });

  describe('returnMember', () => {
    it('leftからactiveへ復帰（空きあり）', () => {
      state.addMember(makeMember({ id: 'hero' }));
      state.removeMember('hero');
      expect(state.left).toHaveLength(1);

      const success = state.returnMember('hero');
      expect(success).toBe(true);
      expect(state.left).toHaveLength(0);
      expect(state.active).toHaveLength(1);
    });

    it('leftからreserveへ復帰（active満員）', () => {
      for (let i = 0; i < MAX_PARTY; i++) {
        state.addMember(makeMember({ id: `m${i}` }));
      }
      state.left.push(makeMember({ id: 'returning' }));

      const success = state.returnMember('returning');
      expect(success).toBe(true);
      expect(state.active).toHaveLength(MAX_PARTY);
      expect(state.reserve).toHaveLength(1);
      expect(state.reserve[0].id).toBe('returning');
    });

    it('leftに存在しない → false', () => {
      expect(state.returnMember('nobody')).toBe(false);
    });
  });

  // ================================================================
  // swapMember
  // ================================================================
  describe('swapMember', () => {
    beforeEach(() => {
      state.active = [makeMember({ id: 'a1' }), makeMember({ id: 'a2' })];
      state.reserve = [makeMember({ id: 'r1' })];
    });

    it('正常に入れ替え', () => {
      state.swapMember(0, 0);
      expect(state.active[0].id).toBe('r1');
      expect(state.reserve[0].id).toBe('a1');
    });

    it('範囲外インデックス → 何もしない', () => {
      state.swapMember(99, 0);
      expect(state.active[0].id).toBe('a1');
    });

    it('storyLocked=true → 入れ替え不可', () => {
      state.active[0] = makeMember({ id: 'locked', storyLocked: true });
      state.swapMember(0, 0);
      expect(state.active[0].id).toBe('locked');
    });
  });

  // ================================================================
  // アイテム管理
  // ================================================================
  describe('addItem', () => {
    it('新規アイテム追加', () => {
      expect(state.addItem('herb')).toBe(true);
      expect(state.getItemCount('herb')).toBe(1);
    });

    it('既存アイテムのスタック増加', () => {
      state.addItem('herb', 3);
      state.addItem('herb', 2);
      expect(state.getItemCount('herb')).toBe(5);
    });

    it('MAX_ITEM_SLOTS超過 → false', () => {
      for (let i = 0; i < MAX_ITEM_SLOTS; i++) {
        state.addItem(`item${i}`);
      }
      expect(state.addItem('overflow')).toBe(false);
      expect(state.items).toHaveLength(MAX_ITEM_SLOTS);
    });

    it('既存アイテムはスロット数に影響しない', () => {
      for (let i = 0; i < MAX_ITEM_SLOTS; i++) {
        state.addItem(`item${i}`);
      }
      // 既存アイテムへの追加はスロット消費しない
      expect(state.addItem('item0', 5)).toBe(true);
      expect(state.getItemCount('item0')).toBe(6);
    });
  });

  describe('useItem', () => {
    it('正常消費', () => {
      state.addItem('herb', 3);
      expect(state.useItem('herb')).toBe(true);
      expect(state.getItemCount('herb')).toBe(2);
    });

    it('数量不足 → false', () => {
      state.addItem('herb', 1);
      expect(state.useItem('herb', 2)).toBe(false);
      expect(state.getItemCount('herb')).toBe(1);
    });

    it('残数0で配列から削除', () => {
      state.addItem('herb', 1);
      state.useItem('herb', 1);
      expect(state.items.find((i) => i.id === 'herb')).toBeUndefined();
    });

    it('存在しないアイテム → false', () => {
      expect(state.useItem('nonexistent')).toBe(false);
    });
  });

  describe('getItemCount', () => {
    it('存在しないアイテム → 0', () => {
      expect(state.getItemCount('nothing')).toBe(0);
    });
  });

  // ================================================================
  // toPartyData / loadFromSave
  // ================================================================
  describe('シリアライズ/デシリアライズ', () => {
    it('toPartyDataが正しいデータを返す', () => {
      state.active = [makeMember({ id: 'hero' })];
      state.reserve = [makeMember({ id: 'mage' })];
      state.left = [];
      state.gold = 100;
      state.items = [{ id: 'herb', count: 3 }];

      const data = state.toPartyData();
      expect(data.active).toHaveLength(1);
      expect(data.reserve).toHaveLength(1);
      expect(data.gold).toBe(100);
      expect(data.items).toEqual([{ id: 'herb', count: 3 }]);
    });

    it('items配列はシャローコピー（要素オブジェクトは参照共有）', () => {
      // 注意: toPartyData()は[...this.items]で配列自体はコピーするが、
      // 要素オブジェクトは参照共有される。ディープコピーが必要な場合は要修正。
      state.items = [{ id: 'herb', count: 3 }];
      const data = state.toPartyData();
      // 配列自体は別オブジェクト
      expect(data.items).not.toBe(state.items);
      // ただし要素は参照共有（既知の制限事項）
      data.items[0].count = 99;
      expect(state.items[0].count).toBe(99);
    });

    it('loadFromSaveで状態が復元される', () => {
      const saveData: SaveData = {
        version: 1,
        slotId: 1,
        party: {
          active: [makeMember({ id: 'hero' })],
          reserve: [],
          left: [makeMember({ id: 'mage' })],
          gold: 500,
          items: [{ id: 'key', count: 1 }],
        },
        storyFlags: {},
        currentChapter: 'ch1',
        currentMap: 'village',
        playerPosition: { x: 5, y: 5 },
        visitedMaps: ['village'],
        lastSavePoint: { map: 'village', x: 5, y: 5 },
        playTime: 3600,
        savedAt: '2026-01-01',
      };

      state.loadFromSave(saveData);
      expect(state.active[0].id).toBe('hero');
      expect(state.left[0].id).toBe('mage');
      expect(state.gold).toBe(500);
      expect(state.playTime).toBe(3600);
    });
  });

  // ================================================================
  // allMembers
  // ================================================================
  describe('allMembers', () => {
    it('activeとreserveを結合', () => {
      state.active = [makeMember({ id: 'a' })];
      state.reserve = [makeMember({ id: 'b' })];
      state.left = [makeMember({ id: 'c' })]; // leftは含まない
      expect(state.allMembers.map((m) => m.id)).toEqual(['a', 'b']);
    });
  });
});

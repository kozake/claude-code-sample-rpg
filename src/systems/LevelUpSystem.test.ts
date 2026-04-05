import { describe, it, expect, beforeEach } from 'vitest';
import { LevelUpSystem } from './LevelUpSystem';
import type { PartyMember, LevelTable } from '../data/types';

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
    attack: 10,
    defense: 8,
    speed: 5,
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

const testTable: LevelTable = {
  classId: 'warrior',
  entries: [
    { level: 1, expRequired: 0, maxHp: 30, maxMp: 5, attack: 10, defense: 8, speed: 5 },
    { level: 2, expRequired: 100, maxHp: 40, maxMp: 8, attack: 14, defense: 11, speed: 7 },
    { level: 3, expRequired: 300, maxHp: 52, maxMp: 12, attack: 19, defense: 15, speed: 9 },
    { level: 4, expRequired: 600, maxHp: 65, maxMp: 16, attack: 25, defense: 19, speed: 12 },
  ],
};

describe('LevelUpSystem', () => {
  let system: LevelUpSystem;

  beforeEach(() => {
    system = new LevelUpSystem();
    system.loadTables([testTable]);
  });

  // ================================================================
  // checkLevelUp
  // ================================================================
  describe('checkLevelUp', () => {
    it('経験値不足 → null', () => {
      const member = makeMember({ exp: 50 }); // 100未満
      expect(system.checkLevelUp(member)).toBeNull();
    });

    it('経験値到達でレベルアップ', () => {
      const member = makeMember({ exp: 100 });
      const result = system.checkLevelUp(member);
      expect(result).not.toBeNull();
      expect(result!.oldLevel).toBe(1);
      expect(result!.newLevel).toBe(2);
      expect(member.level).toBe(2);
    });

    it('ステータス差分(gains)が正しい', () => {
      const member = makeMember({ exp: 100 });
      const result = system.checkLevelUp(member)!;
      expect(result.gains).toEqual({
        maxHp: 10,  // 40 - 30
        maxMp: 3,   // 8 - 5
        attack: 4,  // 14 - 10
        defense: 3, // 11 - 8
        speed: 2,   // 7 - 5
      });
    });

    it('HP/MPが増加分だけ回復（全回復ではない）', () => {
      const member = makeMember({ hp: 20, maxHp: 30, mp: 3, maxMp: 5, exp: 100 });
      system.checkLevelUp(member);
      // HP: min(20 + 10, 40) = 30 (全回復ではない)
      expect(member.hp).toBe(30);
      // MP: min(3 + 3, 8) = 6
      expect(member.mp).toBe(6);
    });

    it('HP/MPが既にmaxHp以上のとき上限を超えない', () => {
      const member = makeMember({ hp: 30, maxHp: 30, mp: 5, maxMp: 5, exp: 100 });
      system.checkLevelUp(member);
      expect(member.hp).toBe(40); // min(30 + 10, 40) = 40
      expect(member.maxHp).toBe(40);
    });

    it('テーブル未登録のクラス → null', () => {
      const member = makeMember({ class: 'mage', exp: 9999 });
      expect(system.checkLevelUp(member)).toBeNull();
    });

    it('最大レベル到達後 → null', () => {
      const member = makeMember({
        level: 4,
        exp: 9999,
        maxHp: 65, maxMp: 16, attack: 25, defense: 19, speed: 12,
      });
      expect(system.checkLevelUp(member)).toBeNull();
    });
  });

  // ================================================================
  // processAllLevelUps
  // ================================================================
  describe('processAllLevelUps', () => {
    it('一気に複数レベルアップ', () => {
      const member = makeMember({ exp: 600 }); // Lv1→2→3→4
      const results = system.processAllLevelUps(member);
      expect(results).toHaveLength(3);
      expect(member.level).toBe(4);
      expect(member.maxHp).toBe(65);
    });

    it('レベルアップなし → 空配列', () => {
      const member = makeMember({ exp: 0 });
      expect(system.processAllLevelUps(member)).toEqual([]);
    });
  });

  // ================================================================
  // generateMessages
  // ================================================================
  describe('generateMessages', () => {
    it('レベルアップメッセージを生成', () => {
      const member = makeMember({ exp: 100 });
      const result = system.checkLevelUp(member)!;
      const messages = LevelUpSystem.generateMessages(result);
      expect(messages[0]).toBe('ゆうしゃは レベル2に あがった！');
      expect(messages).toContain('さいだいHPが 10 あがった！');
      expect(messages).toContain('ちからが 4 あがった！');
    });

    it('0増加のステータスはメッセージに含まない', () => {
      const result = {
        member: makeMember(),
        oldLevel: 1,
        newLevel: 2,
        gains: { maxHp: 5, maxMp: 0, attack: 3, defense: 0, speed: 0 },
        newSpells: [],
      };
      const messages = LevelUpSystem.generateMessages(result);
      expect(messages).toHaveLength(3); // レベルアップ + HP + 攻撃
      expect(messages.some((m) => m.includes('MP'))).toBe(false);
    });

    it('習得呪文メッセージ', () => {
      const result = {
        member: makeMember(),
        oldLevel: 1,
        newLevel: 2,
        gains: { maxHp: 0, maxMp: 0, attack: 0, defense: 0, speed: 0 },
        newSpells: ['ホイミ'],
      };
      const messages = LevelUpSystem.generateMessages(result);
      expect(messages).toContain('ゆうしゃは ホイミを おぼえた！');
    });
  });
});

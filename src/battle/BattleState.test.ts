import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BattleState } from './BattleState';
import type { PartyMember, EnemyData } from '../data/types';

/** テスト用パーティメンバーを生成 */
function makePartyMember(overrides: Partial<PartyMember> = {}): PartyMember {
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
    removable: false,
    storyLocked: false,
    ...overrides,
  };
}

/** テスト用敵データを生成 */
function makeEnemyData(overrides: Partial<EnemyData> = {}): EnemyData {
  return {
    id: 'slime',
    name: 'スライム',
    hp: 10,
    attack: 8,
    defense: 4,
    speed: 5,
    exp: 3,
    gold: 2,
    sprite: 'slime',
    skills: [{ type: 'attack', weight: 1 }],
    fleeResistance: 0,
    ...overrides,
  };
}

describe('BattleState', () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  // ================================================================
  // calcDamage
  // ================================================================
  describe('calcDamage', () => {
    it('基本ダメージ計算: (atk/2) - (def/4)', () => {
      // atk=20, def=8 → base = 10 - 2 = 8, variance = 0 (floor(8*0.1)=0)
      // randomがどの値でもbase=8
      randomSpy.mockReturnValue(0.5);
      expect(BattleState.calcDamage(20, 8)).toBe(8);
    });

    it('分散が±10%の範囲内', () => {
      // atk=100, def=40 → base = 50 - 10 = 40, variance = 4
      // damage = 40 + floor(random * 9) - 4
      randomSpy.mockReturnValue(0); // → 40 + 0 - 4 = 36
      expect(BattleState.calcDamage(100, 40)).toBe(36);

      randomSpy.mockReturnValue(0.999); // → 40 + 8 - 4 = 44
      expect(BattleState.calcDamage(100, 40)).toBe(44);
    });

    it('base <= 0 の場合、最低1ダメージ', () => {
      // atk=4, def=100 → base = 2 - 25 = -23
      randomSpy.mockReturnValue(0);
      expect(BattleState.calcDamage(4, 100)).toBe(1);

      randomSpy.mockReturnValue(0.999);
      expect(BattleState.calcDamage(4, 100)).toBe(1);
    });

    it('base <= 0 かつ random >= 0.5 で1ダメージ', () => {
      randomSpy.mockReturnValue(0.5);
      // floor(0.5 * 2) = 1, max(1, 1) = 1
      expect(BattleState.calcDamage(0, 100)).toBe(1);
    });

    it('統計的検証: 1000回実行で期待範囲内', () => {
      randomSpy.mockRestore();
      const results: number[] = [];
      for (let i = 0; i < 1000; i++) {
        results.push(BattleState.calcDamage(100, 40));
      }
      const min = Math.min(...results);
      const max = Math.max(...results);
      // base=40, variance=4 → 範囲は36〜44
      expect(min).toBeGreaterThanOrEqual(36);
      expect(max).toBeLessThanOrEqual(44);
    });
  });

  // ================================================================
  // elementMultiplier
  // ================================================================
  describe('elementMultiplier', () => {
    it('weak → 1.5', () => expect(BattleState.elementMultiplier('weak')).toBe(1.5));
    it('resist → 0.5', () => expect(BattleState.elementMultiplier('resist')).toBe(0.5));
    it('immune → 0', () => expect(BattleState.elementMultiplier('immune')).toBe(0));
    it('normal → 1.0', () => expect(BattleState.elementMultiplier('normal')).toBe(1.0));
    it('undefined → 1.0', () => expect(BattleState.elementMultiplier(undefined)).toBe(1.0));
  });

  // ================================================================
  // isCritical / isDodged
  // ================================================================
  describe('isCritical', () => {
    it('rate=0 → 必ずfalse', () => {
      randomSpy.mockReturnValue(0);
      expect(BattleState.isCritical(0)).toBe(false);
    });

    it('rate=100 で random < 1 → true', () => {
      randomSpy.mockReturnValue(0.99);
      expect(BattleState.isCritical(100)).toBe(true);
    });

    it('rate=50 のボーダー判定', () => {
      randomSpy.mockReturnValue(0.49); // 0.49 * 100 = 49 < 50 → true
      expect(BattleState.isCritical(50)).toBe(true);

      randomSpy.mockReturnValue(0.51); // 0.51 * 100 = 51 >= 50 → false
      expect(BattleState.isCritical(50)).toBe(false);
    });
  });

  describe('isDodged', () => {
    it('dodgeRate=0 → 必ずfalse', () => {
      randomSpy.mockReturnValue(0);
      expect(BattleState.isDodged(0)).toBe(false);
    });

    it('dodgeRate=100 → true', () => {
      randomSpy.mockReturnValue(0.99);
      expect(BattleState.isDodged(100)).toBe(true);
    });
  });

  // ================================================================
  // executePartyAttack
  // ================================================================
  describe('executePartyAttack', () => {
    let state: BattleState;

    beforeEach(() => {
      state = new BattleState(
        [makePartyMember({ attack: 40, criticalRate: 0 })],
        [makeEnemyData({ hp: 50, defense: 8, dodgeRate: 0 })]
      );
    });

    it('通常攻撃でダメージを与える', () => {
      randomSpy.mockReturnValue(0.5);
      const result = state.executePartyAttack(0, 0);
      expect(result.missed).toBe(false);
      expect(result.critical).toBe(false);
      expect(result.damage).toBeGreaterThan(0);
      expect(state.enemies[0].currentHp).toBe(50 - result.damage!);
    });

    it('敵HP0以下で撃破', () => {
      // 敵HPを1にして攻撃
      state.enemies[0].currentHp = 1;
      randomSpy.mockReturnValue(0.5);
      const result = state.executePartyAttack(0, 0);
      expect(result.targetDied).toBe(true);
      expect(state.enemies[0].isAlive).toBe(false);
      expect(state.enemies[0].currentHp).toBe(0);
    });

    it('回避時はダメージ0', () => {
      state = new BattleState(
        [makePartyMember()],
        [makeEnemyData({ dodgeRate: 100 })]
      );
      randomSpy.mockReturnValue(0); // isDodged: 0 < 100 → true
      const result = state.executePartyAttack(0, 0);
      expect(result.missed).toBe(true);
      expect(result.damage).toBe(0);
    });

    it('クリティカルヒット: ダメージ = 攻撃力 × 0.8', () => {
      state = new BattleState(
        [makePartyMember({ attack: 50, criticalRate: 100 })],
        [makeEnemyData({ hp: 100, dodgeRate: 0 })]
      );
      randomSpy.mockReturnValue(0); // isCritical: 0 < 100 → true
      const result = state.executePartyAttack(0, 0);
      expect(result.critical).toBe(true);
      expect(result.damage).toBe(40); // 50 * 0.8 = 40
    });
  });

  // ================================================================
  // executeEnemyAction
  // ================================================================
  describe('executeEnemyAction', () => {
    it('nothing スキルでは何もしない', () => {
      const state = new BattleState(
        [makePartyMember()],
        [makeEnemyData({ skills: [{ type: 'nothing', weight: 1 }] })]
      );
      randomSpy.mockReturnValue(0);
      const result = state.executeEnemyAction(0);
      expect(result.messages).toContain('スライムは ようすを みている。');
      expect(result.damage).toBeUndefined();
    });

    it('guard スキルで防御メッセージ', () => {
      const state = new BattleState(
        [makePartyMember()],
        [makeEnemyData({ skills: [{ type: 'guard', weight: 1 }] })]
      );
      randomSpy.mockReturnValue(0);
      const result = state.executeEnemyAction(0);
      expect(result.messages).toContain('スライムは みをまもっている。');
    });

    it('防御中の味方には defense × 2 が適用', () => {
      const member = makePartyMember({ defense: 20, dodgeRate: 0 });
      const state = new BattleState(
        [member],
        [makeEnemyData({ attack: 30, criticalRate: 0, dodgeRate: 0, skills: [{ type: 'attack', weight: 1 }] })]
      );
      state.partyDefending.add(0);
      // ランダム値を固定: スキル選択用、ターゲット選択用、回避判定用、ダメージ計算用
      randomSpy.mockReturnValue(0.5);
      const result = state.executeEnemyAction(0);
      // defense=20*2=40 → calcDamage(30, 40): base = 15 - 10 = 5
      expect(result.damage).toBeGreaterThan(0);
      expect(result.missed).toBe(false);
    });

    it('パーティ全滅時は空の結果', () => {
      const state = new BattleState(
        [makePartyMember({ hp: 0 })],
        [makeEnemyData({ skills: [{ type: 'attack', weight: 1 }] })]
      );
      randomSpy.mockReturnValue(0);
      const result = state.executeEnemyAction(0);
      expect(result.messages).toEqual([]);
    });
  });

  // ================================================================
  // attemptFlee
  // ================================================================
  describe('attemptFlee', () => {
    it('速度同等で50%基本確率', () => {
      const state = new BattleState(
        [makePartyMember({ speed: 10 })],
        [makeEnemyData({ speed: 10 })]
      );
      // chance = 50 + (10 - 10) * 2 = 50%
      randomSpy.mockReturnValue(0.49); // 49 < 50 → 成功
      expect(state.attemptFlee().success).toBe(true);

      randomSpy.mockReturnValue(0.51); // 51 >= 50 → 失敗
      expect(state.attemptFlee().success).toBe(false);
    });

    it('最低10%にクランプ', () => {
      const state = new BattleState(
        [makePartyMember({ speed: 1 })],
        [makeEnemyData({ speed: 100 })]
      );
      // chance = 50 + (1 - 100) * 2 = -148 → clamp to 10
      randomSpy.mockReturnValue(0.09);
      expect(state.attemptFlee().success).toBe(true);

      randomSpy.mockReturnValue(0.11);
      expect(state.attemptFlee().success).toBe(false);
    });

    it('最大90%にクランプ', () => {
      const state = new BattleState(
        [makePartyMember({ speed: 100 })],
        [makeEnemyData({ speed: 1 })]
      );
      // chance = 50 + (100 - 1) * 2 = 248 → clamp to 90
      randomSpy.mockReturnValue(0.89);
      expect(state.attemptFlee().success).toBe(true);

      randomSpy.mockReturnValue(0.91);
      expect(state.attemptFlee().success).toBe(false);
    });
  });

  // ================================================================
  // checkBattleEnd
  // ================================================================
  describe('checkBattleEnd', () => {
    it('全敵撃破 → victory', () => {
      const state = new BattleState(
        [makePartyMember({ hp: 10 })],
        [makeEnemyData()]
      );
      state.enemies[0].isAlive = false;
      expect(state.checkBattleEnd()).toBe('victory');
      expect(state.isOver).toBe(true);
      expect(state.isVictory).toBe(true);
    });

    it('全味方HP0 → defeat', () => {
      const state = new BattleState(
        [makePartyMember({ hp: 0 })],
        [makeEnemyData()]
      );
      expect(state.checkBattleEnd()).toBe('defeat');
      expect(state.isOver).toBe(true);
      expect(state.isVictory).toBe(false);
    });

    it('両方生存 → continue', () => {
      const state = new BattleState(
        [makePartyMember({ hp: 10 })],
        [makeEnemyData()]
      );
      expect(state.checkBattleEnd()).toBe('continue');
      expect(state.isOver).toBe(false);
    });
  });

  // ================================================================
  // getVictoryRewards
  // ================================================================
  describe('getVictoryRewards', () => {
    it('EXPとGoldを合算', () => {
      const state = new BattleState(
        [makePartyMember()],
        [makeEnemyData({ exp: 10, gold: 5 }), makeEnemyData({ exp: 20, gold: 15 })]
      );
      const rewards = state.getVictoryRewards();
      expect(rewards.exp).toBe(30);
      expect(rewards.gold).toBe(20);
    });

    it('ドロップrate=1.0で必ずドロップ', () => {
      const state = new BattleState(
        [makePartyMember()],
        [makeEnemyData({ dropItem: { id: 'herb', rate: 1.0 } })]
      );
      randomSpy.mockReturnValue(0.99);
      const rewards = state.getVictoryRewards();
      expect(rewards.drops).toHaveLength(1);
      expect(rewards.drops[0].id).toBe('herb');
    });

    it('ドロップrate=0で絶対ドロップしない', () => {
      const state = new BattleState(
        [makePartyMember()],
        [makeEnemyData({ dropItem: { id: 'herb', rate: 0 } })]
      );
      randomSpy.mockReturnValue(0);
      const rewards = state.getVictoryRewards();
      expect(rewards.drops).toHaveLength(0);
    });

    it('ドロップなしの敵', () => {
      const state = new BattleState(
        [makePartyMember()],
        [makeEnemyData()]
      );
      const rewards = state.getVictoryRewards();
      expect(rewards.drops).toHaveLength(0);
    });
  });

  // ================================================================
  // getTurnOrder
  // ================================================================
  describe('getTurnOrder', () => {
    it('生存中の敵のみ行動順に含まれる', () => {
      const state = new BattleState(
        [makePartyMember()],
        [makeEnemyData({ speed: 10 }), makeEnemyData({ speed: 5 })]
      );
      state.enemies[1].isAlive = false;
      const order = state.getTurnOrder();
      expect(order).toHaveLength(1);
      expect(order[0].actorIndex).toBe(0);
    });
  });

  // ================================================================
  // constructor
  // ================================================================
  describe('constructor', () => {
    it('敵のHPが最大値で初期化される', () => {
      const state = new BattleState(
        [makePartyMember()],
        [makeEnemyData({ hp: 50 })]
      );
      expect(state.enemies[0].currentHp).toBe(50);
      expect(state.enemies[0].isAlive).toBe(true);
      expect(state.enemies[0].statusEffects).toEqual([]);
    });

    it('ターンカウント初期値0', () => {
      const state = new BattleState([makePartyMember()], [makeEnemyData()]);
      expect(state.turnCount).toBe(0);
      expect(state.isOver).toBe(false);
    });
  });
});

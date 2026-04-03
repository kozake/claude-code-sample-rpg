import type { PartyMember, EnemyData, EnemySkill, ElementType, ResistLevel, StatusEffect } from '../data/types';

/** 戦闘中の敵インスタンス */
export interface BattleEnemy {
  data: EnemyData;
  currentHp: number;
  statusEffects: StatusEffect[];
  isAlive: boolean;
}

/** 行動コマンド */
export interface BattleAction {
  type: 'attack' | 'spell' | 'item' | 'defend' | 'flee';
  actor: 'party' | 'enemy';
  actorIndex: number;
  targetIndex?: number;
  spellId?: string;
  itemId?: string;
}

/** ターン結果 */
export interface ActionResult {
  action: BattleAction;
  actorName: string;
  targetName?: string;
  damage?: number;
  healed?: number;
  missed: boolean;
  critical: boolean;
  messages: string[];
  targetDied: boolean;
}

/**
 * 戦闘状態管理
 * - DQ風ダメージ計算: (attack/2) - (defense/4) ± 10%
 * - クリティカル / ミス判定
 * - 属性耐性
 */
export class BattleState {
  party: PartyMember[];
  enemies: BattleEnemy[];
  turnCount = 0;
  isOver = false;
  isVictory = false;
  partyDefending = new Set<number>();

  constructor(party: PartyMember[], enemyDataList: EnemyData[]) {
    this.party = party;
    this.enemies = enemyDataList.map((data) => ({
      data,
      currentHp: data.hp,
      statusEffects: [],
      isAlive: true,
    }));
  }

  /** DQ風ダメージ計算 */
  static calcDamage(attack: number, defense: number): number {
    const base = Math.floor(attack / 2) - Math.floor(defense / 4);
    if (base <= 0) return Math.max(1, Math.floor(Math.random() * 2));
    const variance = Math.floor(base * 0.1);
    return base + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
  }

  /** 属性耐性によるダメージ倍率 */
  static elementMultiplier(resist: ResistLevel | undefined): number {
    switch (resist) {
      case 'weak': return 1.5;
      case 'resist': return 0.5;
      case 'immune': return 0;
      default: return 1.0;
    }
  }

  /** クリティカル判定 */
  static isCritical(rate: number): boolean {
    return Math.random() * 100 < rate;
  }

  /** 回避判定 */
  static isDodged(dodgeRate: number): boolean {
    return Math.random() * 100 < dodgeRate;
  }

  /** パーティメンバー → 敵への通常攻撃 */
  executePartyAttack(partyIdx: number, enemyIdx: number): ActionResult {
    const member = this.party[partyIdx];
    const enemy = this.enemies[enemyIdx];
    const messages: string[] = [];
    let missed = false;
    let critical = false;
    let damage = 0;
    let targetDied = false;

    messages.push(`${member.name}の こうげき！`);

    // 回避判定
    if (BattleState.isDodged(enemy.data.dodgeRate ?? 0)) {
      missed = true;
      messages.push(`${enemy.data.name}は ひらりと みをかわした！`);
    } else {
      // クリティカル判定
      if (BattleState.isCritical(member.criticalRate)) {
        critical = true;
        damage = Math.floor(member.attack * 0.8);
        messages.push('かいしんの いちげき！');
      } else {
        damage = BattleState.calcDamage(member.attack, enemy.data.defense);
      }

      enemy.currentHp -= damage;
      messages.push(`${enemy.data.name}に ${damage}の ダメージ！`);

      if (enemy.currentHp <= 0) {
        enemy.currentHp = 0;
        enemy.isAlive = false;
        targetDied = true;
        messages.push(`${enemy.data.name}を たおした！`);
      }
    }

    return {
      action: { type: 'attack', actor: 'party', actorIndex: partyIdx, targetIndex: enemyIdx },
      actorName: member.name,
      targetName: enemy.data.name,
      damage,
      missed,
      critical,
      messages,
      targetDied,
    };
  }

  /** 敵 → パーティメンバーへの攻撃 */
  executeEnemyAction(enemyIdx: number): ActionResult {
    const enemy = this.enemies[enemyIdx];
    const skill = this.selectEnemySkill(enemy);
    const messages: string[] = [];
    let damage = 0;
    let missed = false;
    let critical = false;
    let targetDied = false;
    let targetName = '';

    if (skill.type === 'nothing') {
      messages.push(`${enemy.data.name}は ようすを みている。`);
      return {
        action: { type: 'attack', actor: 'enemy', actorIndex: enemyIdx },
        actorName: enemy.data.name,
        missed: false,
        critical: false,
        messages,
        targetDied: false,
      };
    }

    if (skill.type === 'guard') {
      messages.push(`${enemy.data.name}は みをまもっている。`);
      return {
        action: { type: 'defend', actor: 'enemy', actorIndex: enemyIdx },
        actorName: enemy.data.name,
        missed: false,
        critical: false,
        messages,
        targetDied: false,
      };
    }

    // 通常攻撃
    const aliveMembers = this.party.filter((m) => m.hp > 0);
    if (aliveMembers.length === 0) {
      return {
        action: { type: 'attack', actor: 'enemy', actorIndex: enemyIdx },
        actorName: enemy.data.name,
        missed: false,
        critical: false,
        messages: [],
        targetDied: false,
      };
    }

    const target = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];
    const targetIdx = this.party.indexOf(target);
    targetName = target.name;

    messages.push(`${enemy.data.name}の こうげき！`);

    if (BattleState.isDodged(target.dodgeRate)) {
      missed = true;
      messages.push(`${target.name}は ひらりと みをかわした！`);
    } else {
      const defense = this.partyDefending.has(targetIdx) ? target.defense * 2 : target.defense;

      if (BattleState.isCritical(enemy.data.criticalRate ?? 0)) {
        critical = true;
        damage = Math.floor(enemy.data.attack * 0.8);
        messages.push('つうこんの いちげき！');
      } else {
        damage = BattleState.calcDamage(enemy.data.attack, defense);
      }

      target.hp -= damage;
      messages.push(`${target.name}に ${damage}の ダメージ！`);

      if (target.hp <= 0) {
        target.hp = 0;
        targetDied = true;
        messages.push(`${target.name}は ちからつきた...`);
      }
    }

    return {
      action: { type: 'attack', actor: 'enemy', actorIndex: enemyIdx, targetIndex: targetIdx },
      actorName: enemy.data.name,
      targetName,
      damage,
      missed,
      critical,
      messages,
      targetDied,
    };
  }

  /** 重み付きランダムで敵スキル選択 */
  private selectEnemySkill(enemy: BattleEnemy): EnemySkill {
    const hpRatio = enemy.currentHp / enemy.data.hp;
    const available = enemy.data.skills.filter(
      (s) => !s.hpThreshold || hpRatio <= s.hpThreshold
    );

    if (available.length === 0) {
      return { type: 'attack', weight: 1 };
    }

    const totalWeight = available.reduce((sum, s) => sum + s.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const skill of available) {
      roll -= skill.weight;
      if (roll <= 0) return skill;
    }
    return available[0];
  }

  /** 逃走判定 */
  attemptFlee(): { success: boolean; messages: string[] } {
    const avgPartySpeed = this.party.reduce((sum, m) => sum + m.speed, 0) / this.party.length;
    const avgEnemySpeed = this.enemies.reduce((sum, e) => sum + e.data.speed, 0) / this.enemies.length;

    // 逃走成功率: 基本50% + (パーティ速度 - 敵速度) * 2%
    const baseChance = 50 + (avgPartySpeed - avgEnemySpeed) * 2;
    const chance = Math.max(10, Math.min(90, baseChance));

    if (Math.random() * 100 < chance) {
      return { success: true, messages: ['うまく にげきれた！'] };
    }
    return { success: false, messages: ['しかし まわりこまれてしまった！'] };
  }

  /** 行動順序決定（速度ベース） */
  getTurnOrder(): BattleAction[] {
    const actions: { speed: number; action: BattleAction }[] = [];

    // パーティの行動は後から設定（コマンド選択後）
    // ここでは敵の行動順序の基本速度を使う
    this.enemies.forEach((enemy, i) => {
      if (enemy.isAlive) {
        actions.push({
          speed: enemy.data.speed + Math.random() * 10,
          action: { type: 'attack', actor: 'enemy', actorIndex: i },
        });
      }
    });

    actions.sort((a, b) => b.speed - a.speed);
    return actions.map((a) => a.action);
  }

  /** 戦闘終了チェック */
  checkBattleEnd(): 'continue' | 'victory' | 'defeat' {
    if (this.enemies.every((e) => !e.isAlive)) {
      this.isOver = true;
      this.isVictory = true;
      return 'victory';
    }
    if (this.party.every((m) => m.hp <= 0)) {
      this.isOver = true;
      this.isVictory = false;
      return 'defeat';
    }
    return 'continue';
  }

  /** 勝利報酬 */
  getVictoryRewards(): { exp: number; gold: number; drops: { id: string; name: string }[] } {
    let exp = 0;
    let gold = 0;
    const drops: { id: string; name: string }[] = [];

    for (const enemy of this.enemies) {
      exp += enemy.data.exp;
      gold += enemy.data.gold;
      if (enemy.data.dropItem && Math.random() < enemy.data.dropItem.rate) {
        drops.push({ id: enemy.data.dropItem.id, name: enemy.data.dropItem.id });
      }
    }

    return { exp, gold, drops };
  }
}

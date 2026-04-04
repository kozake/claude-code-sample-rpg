import type { PartyMember, LevelTable, LevelUpEntry } from '../data/types';

export interface LevelUpResult {
  member: PartyMember;
  oldLevel: number;
  newLevel: number;
  gains: {
    maxHp: number;
    maxMp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  newSpells: string[];
}

/**
 * レベルアップシステム
 * - 経験値チェック → レベルアップ判定
 * - ステータス上昇計算
 */
export class LevelUpSystem {
  private tables: Map<string, LevelUpEntry[]> = new Map();

  /** レベルテーブルをロード */
  loadTables(tables: LevelTable[]): void {
    for (const table of tables) {
      this.tables.set(table.classId, table.entries);
    }
  }

  /** 経験値に基づいてレベルアップ判定 */
  checkLevelUp(member: PartyMember): LevelUpResult | null {
    const entries = this.tables.get(member.class);
    if (!entries) return null;

    const nextEntry = entries.find((e) => e.level === member.level + 1);
    if (!nextEntry || member.exp < nextEntry.expRequired) return null;

    const oldLevel = member.level;
    const gains = {
      maxHp: nextEntry.maxHp - member.maxHp,
      maxMp: nextEntry.maxMp - member.maxMp,
      attack: nextEntry.attack - member.attack,
      defense: nextEntry.defense - member.defense,
      speed: nextEntry.speed - member.speed,
    };

    // ステータス更新
    member.level = nextEntry.level;
    member.maxHp = nextEntry.maxHp;
    member.maxMp = nextEntry.maxMp;
    member.attack = nextEntry.attack;
    member.defense = nextEntry.defense;
    member.speed = nextEntry.speed;

    // HP/MPも回復分だけ増加
    member.hp = Math.min(member.hp + Math.max(0, gains.maxHp), member.maxHp);
    member.mp = Math.min(member.mp + Math.max(0, gains.maxMp), member.maxMp);

    return {
      member,
      oldLevel,
      newLevel: member.level,
      gains,
      newSpells: [], // TODO: 習得呪文チェック
    };
  }

  /** 複数レベルアップ対応 */
  processAllLevelUps(member: PartyMember): LevelUpResult[] {
    const results: LevelUpResult[] = [];
    let result = this.checkLevelUp(member);
    while (result) {
      results.push(result);
      result = this.checkLevelUp(member);
    }
    return results;
  }

  /** レベルアップメッセージ生成 */
  static generateMessages(result: LevelUpResult): string[] {
    const messages: string[] = [];
    messages.push(`${result.member.name}は レベル${result.newLevel}に あがった！`);

    const g = result.gains;
    if (g.maxHp > 0) messages.push(`さいだいHPが ${g.maxHp} あがった！`);
    if (g.maxMp > 0) messages.push(`さいだいMPが ${g.maxMp} あがった！`);
    if (g.attack > 0) messages.push(`ちからが ${g.attack} あがった！`);
    if (g.defense > 0) messages.push(`みのまもりが ${g.defense} あがった！`);
    if (g.speed > 0) messages.push(`すばやさが ${g.speed} あがった！`);

    for (const spell of result.newSpells) {
      messages.push(`${result.member.name}は ${spell}を おぼえた！`);
    }

    return messages;
  }
}

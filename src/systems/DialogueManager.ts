import type { NPCData, NPCDialogue, NPCChoice, StoryCondition } from '../data/types';
import type { Game } from '../Game';

/**
 * NPC会話マネージャー
 * - ストーリーフラグに基づく会話分岐
 * - はい/いいえ選択肢
 * - アイテム付与・フラグ設定
 */
export class DialogueManager {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  /** NPCの現在の会話を取得（条件にマッチする最初のもの） */
  getCurrentDialogue(npc: NPCData): NPCDialogue | null {
    for (const dialogue of npc.dialogues) {
      if (!dialogue.condition || this.evaluateCondition(dialogue.condition)) {
        return dialogue;
      }
    }
    return null;
  }

  /** ストーリー条件を評価 */
  evaluateCondition(condition: StoryCondition): boolean {
    switch (condition.type) {
      case 'flag': {
        const value = this.game.storyFlags[condition.key!];
        return this.compareValue(value, condition.value, condition.operator ?? '==');
      }
      case 'item': {
        const count = this.game.state.getItemCount(condition.key!);
        const target = typeof condition.value === 'number' ? condition.value : 1;
        return this.compareValue(count, target, condition.operator ?? '>=');
      }
      case 'level': {
        const heroLevel = this.game.state.active[0]?.level ?? 1;
        const target = typeof condition.value === 'number' ? condition.value : 1;
        return this.compareValue(heroLevel, target, condition.operator ?? '>=');
      }
      case 'and': {
        return (condition.children ?? []).every((c) => this.evaluateCondition(c));
      }
      case 'or': {
        return (condition.children ?? []).some((c) => this.evaluateCondition(c));
      }
      default:
        return true;
    }
  }

  private compareValue(
    actual: boolean | number | string | undefined,
    expected: boolean | number | string | undefined,
    operator: string
  ): boolean {
    if (actual === undefined) actual = false;
    switch (operator) {
      case '==': return actual === expected;
      case '!=': return actual !== expected;
      case '>=': return (actual as number) >= (expected as number);
      case '<=': return (actual as number) <= (expected as number);
      default: return actual === expected;
    }
  }

  /** 会話完了時のアクション実行 */
  executeDialogueActions(dialogue: NPCDialogue): void {
    if (dialogue.setFlags) {
      for (const [key, value] of Object.entries(dialogue.setFlags)) {
        this.game.storyFlags[key] = value;
      }
    }
    if (dialogue.giveItem) {
      const items = Array.isArray(dialogue.giveItem) ? dialogue.giveItem : [dialogue.giveItem];
      for (const item of items) {
        this.game.state.addItem(item.id, item.count);
      }
    }
  }

  /** パーティメンバー追加 */
  private addPartyMember(memberId: string): void {
    // 既にパーティにいる場合はスキップ
    if (this.game.state.allMembers.find((m) => m.id === memberId)) return;
    // 離脱中メンバーは復帰
    if (this.game.state.left.find((m) => m.id === memberId)) {
      this.game.state.returnMember(memberId);
      return;
    }
    // メンバーマスタから取得して追加
    const allMembers = this.game.content.getPartyMembers();
    const memberData = allMembers.find((m) => m.id === memberId);
    if (memberData) {
      this.game.state.addMember({ ...memberData, statusEffects: [] });
    }
  }

  /** 選択肢のアクション実行 */
  executeChoiceAction(choice: NPCChoice): void {
    const action = choice.action;
    if (action.setFlags) {
      for (const [key, value] of Object.entries(action.setFlags)) {
        this.game.storyFlags[key] = value;
      }
    }
    if (action.giveItem) {
      const items = Array.isArray(action.giveItem) ? action.giveItem : [action.giveItem];
      for (const item of items) {
        this.game.state.addItem(item.id, item.count);
      }
    }
    if (action.addPartyMember) {
      this.addPartyMember(action.addPartyMember);
    }
  }
}

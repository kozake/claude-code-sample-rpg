import { describe, it, expect, beforeEach } from 'vitest';
import { DialogueManager } from './DialogueManager';
import { GameState } from './GameState';
import type { StoryCondition, NPCData, NPCDialogue, NPCChoice } from '../data/types';

/**
 * DialogueManagerはGameオブジェクトに依存するため、
 * 最小限のモックGameを使う
 */
function createMockGame(flags: Record<string, boolean | number | string> = {}) {
  const state = new GameState();
  return {
    storyFlags: { ...flags },
    state,
    content: { getPartyMembers: () => [] },
  } as any; // Game型の最小モック
}

describe('DialogueManager', () => {
  let game: ReturnType<typeof createMockGame>;
  let dm: DialogueManager;

  beforeEach(() => {
    game = createMockGame();
    dm = new DialogueManager(game);
  });

  // ================================================================
  // evaluateCondition
  // ================================================================
  describe('evaluateCondition', () => {
    // --- flag条件 ---
    it('flag == true: マッチ', () => {
      game.storyFlags['defeated_boss'] = true;
      const cond: StoryCondition = { type: 'flag', key: 'defeated_boss', value: true };
      expect(dm.evaluateCondition(cond)).toBe(true);
    });

    it('flag == true: 未設定フラグ → false', () => {
      const cond: StoryCondition = { type: 'flag', key: 'unknown_flag', value: true };
      expect(dm.evaluateCondition(cond)).toBe(false);
    });

    it('flag != false: フラグがtrueなら条件成立', () => {
      game.storyFlags['quest_done'] = true;
      const cond: StoryCondition = { type: 'flag', key: 'quest_done', value: false, operator: '!=' };
      expect(dm.evaluateCondition(cond)).toBe(true);
    });

    it('flag 数値比較 >=', () => {
      game.storyFlags['boss_count'] = 3;
      const cond: StoryCondition = { type: 'flag', key: 'boss_count', value: 3, operator: '>=' };
      expect(dm.evaluateCondition(cond)).toBe(true);

      const cond2: StoryCondition = { type: 'flag', key: 'boss_count', value: 4, operator: '>=' };
      expect(dm.evaluateCondition(cond2)).toBe(false);
    });

    // --- item条件 ---
    it('item: アイテム所持チェック（デフォルト >= 1）', () => {
      game.state.addItem('key_item', 1);
      const cond: StoryCondition = { type: 'item', key: 'key_item' };
      expect(dm.evaluateCondition(cond)).toBe(true);
    });

    it('item: アイテム未所持 → false', () => {
      const cond: StoryCondition = { type: 'item', key: 'key_item' };
      expect(dm.evaluateCondition(cond)).toBe(false);
    });

    it('item: 数量指定', () => {
      game.state.addItem('herb', 3);
      const cond: StoryCondition = { type: 'item', key: 'herb', value: 3, operator: '>=' };
      expect(dm.evaluateCondition(cond)).toBe(true);

      const cond2: StoryCondition = { type: 'item', key: 'herb', value: 4, operator: '>=' };
      expect(dm.evaluateCondition(cond2)).toBe(false);
    });

    // --- level条件 ---
    it('level: ヒーローレベルチェック', () => {
      game.state.active = [{
        id: 'hero', name: 'ゆうしゃ', class: 'warrior', level: 5,
        hp: 30, maxHp: 30, mp: 5, maxMp: 5, attack: 20, defense: 10,
        speed: 8, exp: 0, equipment: { weapon: null, armor: null, shield: null, accessory: null },
        spells: [], criticalRate: 4, dodgeRate: 2, statusEffects: [],
        sprite: 'hero', joinedByDefault: true, removable: true, storyLocked: false,
      }];
      const cond: StoryCondition = { type: 'level', value: 5, operator: '>=' };
      expect(dm.evaluateCondition(cond)).toBe(true);

      const cond2: StoryCondition = { type: 'level', value: 6, operator: '>=' };
      expect(dm.evaluateCondition(cond2)).toBe(false);
    });

    it('level: パーティ空 → レベル1として扱う', () => {
      const cond: StoryCondition = { type: 'level', value: 1, operator: '>=' };
      expect(dm.evaluateCondition(cond)).toBe(true);

      const cond2: StoryCondition = { type: 'level', value: 2, operator: '>=' };
      expect(dm.evaluateCondition(cond2)).toBe(false);
    });

    // --- AND/OR ---
    it('and: 全条件true → true', () => {
      game.storyFlags['a'] = true;
      game.storyFlags['b'] = true;
      const cond: StoryCondition = {
        type: 'and',
        children: [
          { type: 'flag', key: 'a', value: true },
          { type: 'flag', key: 'b', value: true },
        ],
      };
      expect(dm.evaluateCondition(cond)).toBe(true);
    });

    it('and: 1つでもfalse → false', () => {
      game.storyFlags['a'] = true;
      const cond: StoryCondition = {
        type: 'and',
        children: [
          { type: 'flag', key: 'a', value: true },
          { type: 'flag', key: 'b', value: true }, // bは未設定
        ],
      };
      expect(dm.evaluateCondition(cond)).toBe(false);
    });

    it('or: 1つでもtrue → true', () => {
      game.storyFlags['a'] = true;
      const cond: StoryCondition = {
        type: 'or',
        children: [
          { type: 'flag', key: 'a', value: true },
          { type: 'flag', key: 'b', value: true },
        ],
      };
      expect(dm.evaluateCondition(cond)).toBe(true);
    });

    it('or: 全false → false', () => {
      const cond: StoryCondition = {
        type: 'or',
        children: [
          { type: 'flag', key: 'a', value: true },
          { type: 'flag', key: 'b', value: true },
        ],
      };
      expect(dm.evaluateCondition(cond)).toBe(false);
    });

    it('and/or: children未定義 → and=true, or=false', () => {
      expect(dm.evaluateCondition({ type: 'and' })).toBe(true);  // every on []
      expect(dm.evaluateCondition({ type: 'or' })).toBe(false);  // some on []
    });

    it('ネスト: and内にor', () => {
      game.storyFlags['x'] = true;
      const cond: StoryCondition = {
        type: 'and',
        children: [
          { type: 'flag', key: 'x', value: true },
          {
            type: 'or',
            children: [
              { type: 'flag', key: 'y', value: true }, // false
              { type: 'flag', key: 'x', value: true }, // true
            ],
          },
        ],
      };
      expect(dm.evaluateCondition(cond)).toBe(true);
    });

    it('不明なtype → true（デフォルト）', () => {
      const cond = { type: 'unknown' } as any;
      expect(dm.evaluateCondition(cond)).toBe(true);
    });
  });

  // ================================================================
  // getCurrentDialogue
  // ================================================================
  describe('getCurrentDialogue', () => {
    it('条件なしダイアログ → 常にマッチ', () => {
      const npc: NPCData = {
        id: 'villager', name: 'むらびと', sprite: 'villager',
        dialogues: [{ lines: ['こんにちは'] }],
      };
      const result = dm.getCurrentDialogue(npc);
      expect(result?.lines).toEqual(['こんにちは']);
    });

    it('条件付きダイアログ → 先頭から評価', () => {
      game.storyFlags['quest_done'] = true;
      const npc: NPCData = {
        id: 'villager', name: 'むらびと', sprite: 'villager',
        dialogues: [
          {
            condition: { type: 'flag', key: 'quest_done', value: true },
            lines: ['クエストクリア後の会話'],
          },
          { lines: ['通常の会話'] },
        ],
      };
      expect(dm.getCurrentDialogue(npc)?.lines[0]).toBe('クエストクリア後の会話');
    });

    it('どの条件にもマッチしない → null', () => {
      const npc: NPCData = {
        id: 'villager', name: 'むらびと', sprite: 'villager',
        dialogues: [
          {
            condition: { type: 'flag', key: 'never_set', value: true },
            lines: ['見えない会話'],
          },
        ],
      };
      expect(dm.getCurrentDialogue(npc)).toBeNull();
    });
  });

  // ================================================================
  // executeDialogueActions
  // ================================================================
  describe('executeDialogueActions', () => {
    it('フラグを設定', () => {
      const dialogue: NPCDialogue = {
        lines: ['テスト'],
        setFlags: { 'quest_started': true, 'npc_talked': 1 },
      };
      dm.executeDialogueActions(dialogue);
      expect(game.storyFlags['quest_started']).toBe(true);
      expect(game.storyFlags['npc_talked']).toBe(1);
    });

    it('アイテム付与（単体）', () => {
      const dialogue: NPCDialogue = {
        lines: ['テスト'],
        giveItem: { id: 'herb', count: 3 },
      };
      dm.executeDialogueActions(dialogue);
      expect(game.state.getItemCount('herb')).toBe(3);
    });

    it('アイテム付与（配列）', () => {
      const dialogue: NPCDialogue = {
        lines: ['テスト'],
        giveItem: [
          { id: 'herb', count: 2 },
          { id: 'key', count: 1 },
        ],
      };
      dm.executeDialogueActions(dialogue);
      expect(game.state.getItemCount('herb')).toBe(2);
      expect(game.state.getItemCount('key')).toBe(1);
    });

    it('フラグもアイテムもない場合 → エラーなし', () => {
      const dialogue: NPCDialogue = { lines: ['何もしない'] };
      expect(() => dm.executeDialogueActions(dialogue)).not.toThrow();
    });
  });

  // ================================================================
  // executeChoiceAction
  // ================================================================
  describe('executeChoiceAction', () => {
    it('選択肢のフラグ設定とアイテム付与', () => {
      const choice: NPCChoice = {
        label: 'はい',
        action: {
          setFlags: { 'accepted': true },
          giveItem: { id: 'sword', count: 1 },
        },
      };
      dm.executeChoiceAction(choice);
      expect(game.storyFlags['accepted']).toBe(true);
      expect(game.state.getItemCount('sword')).toBe(1);
    });

    it('アクションが空でもエラーなし', () => {
      const choice: NPCChoice = { label: 'いいえ', action: {} };
      expect(() => dm.executeChoiceAction(choice)).not.toThrow();
    });
  });
});

import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';
import type { ItemData, PartyMember } from '../data/types';

/**
 * アイテム一覧画面
 * - 所持アイテム表示（名前表示）
 * - フィールドで使えるアイテムを使用可能
 */
export class ItemScene extends Scene {
  private cursorIndex = 0;
  private cursorText!: Text;
  private onClose: () => void;
  private itemDataMap: Map<string, ItemData> = new Map();
  private phase: 'list' | 'target' | 'message' = 'list';
  private targetCursor = 0;
  private targetCursorText!: Text;
  private selectedItemData: ItemData | null = null;
  private messageText: Text | null = null;
  private messageTimer = 0;

  constructor(game: Game, onClose: () => void) {
    super(game);
    this.onClose = onClose;
  }

  async onEnter(): Promise<void> {
    // アイテムマスタ読み込み
    const allItems = await this.game.content.loadJson<ItemData[]>('items/items.json');
    if (allItems) {
      for (const item of allItems) {
        this.itemDataMap.set(item.id, item);
      }
    }
    this.draw();
  }

  private getItemName(id: string): string {
    return this.itemDataMap.get(id)?.name ?? id;
  }

  private draw(): void {
    this.container.removeChildren();

    const items = this.game.state.items;
    const listH = Math.max(items.length * 28 + 16, 60);

    // アイテムウィンドウ
    const win = new Window(8, 8, GAME_WIDTH - 16, Math.min(listH, GAME_HEIGHT - 60));
    this.container.addChild(win);

    if (items.length === 0) {
      const empty = new Text({
        text: 'もちものが ありません',
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT_DISABLED }),
      });
      empty.x = GAME_WIDTH / 2;
      empty.y = 40;
      empty.anchor.set(0.5);
      this.container.addChild(empty);
    } else {
      const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });

      items.forEach((item, i) => {
        const name = this.getItemName(item.id);
        const text = new Text({
          text: `${name}  x${item.count}`,
          style,
        });
        text.x = 36;
        text.y = 18 + i * 28;
        this.container.addChild(text);
      });

      // カーソル
      this.cursorText = new Text({
        text: '▶',
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.CURSOR }),
      });
      this.updateCursor();
      this.container.addChild(this.cursorText);
    }

    // ヒント
    const hint = new Text({
      text: 'Aボタン: つかう  Bボタン: もどる',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: COLORS.TEXT_DISABLED }),
    });
    hint.anchor.set(0.5);
    hint.x = GAME_WIDTH / 2;
    hint.y = GAME_HEIGHT - 24;
    this.container.addChild(hint);
  }

  private drawTargetSelect(): void {
    this.container.removeChildren();
    this.phase = 'target';
    this.targetCursor = 0;

    const members = this.game.state.active;
    const itemName = this.selectedItemData?.name ?? '';

    // アイテム名ウィンドウ
    const nameWin = new Window(8, 8, GAME_WIDTH - 16, 36);
    this.container.addChild(nameWin);

    const nameText = new Text({
      text: `${itemName}を だれに つかう？`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    nameText.x = 20;
    nameText.y = 18;
    this.container.addChild(nameText);

    // メンバーリスト
    const listWin = new Window(8, 52, GAME_WIDTH - 16, members.length * 32 + 16);
    this.container.addChild(listWin);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });

    members.forEach((m, i) => {
      const hpColor = m.hp <= 0 ? COLORS.HP_RED : m.hp < m.maxHp * 0.3 ? COLORS.HP_YELLOW : COLORS.HP_GREEN;
      const text = new Text({
        text: m.name,
        style,
      });
      text.x = 36;
      text.y = 62 + i * 32;
      this.container.addChild(text);

      const hp = new Text({
        text: `HP ${m.hp}/${m.maxHp}`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: hpColor }),
      });
      hp.x = 140;
      hp.y = 62 + i * 32;
      this.container.addChild(hp);
    });

    this.targetCursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.CURSOR }),
    });
    this.targetCursorText.x = 16;
    this.targetCursorText.y = 66;
    this.container.addChild(this.targetCursorText);

    // ヒント
    const hint = new Text({
      text: 'Bボタン: もどる',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: COLORS.TEXT_DISABLED }),
    });
    hint.anchor.set(0.5);
    hint.x = GAME_WIDTH / 2;
    hint.y = GAME_HEIGHT - 24;
    this.container.addChild(hint);
  }

  private showMessage(msg: string): void {
    this.phase = 'message';
    this.messageTimer = 60; // 約1秒

    this.container.removeChildren();
    const win = new Window(8, GAME_HEIGHT / 2 - 30, GAME_WIDTH - 16, 60);
    this.container.addChild(win);

    this.messageText = new Text({
      text: msg,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    this.messageText.x = 20;
    this.messageText.y = GAME_HEIGHT / 2 - 16;
    this.container.addChild(this.messageText);
  }

  private applyItemEffect(item: ItemData, target: PartyMember): string {
    if (item.type === 'heal' && item.effect.hp) {
      if (target.hp <= 0) {
        return `${target.name}は しんでいる！`;
      }
      if (target.hp >= target.maxHp) {
        return `${target.name}の HPは まんたんだ！`;
      }
      const healAmount = Math.min(item.effect.hp, target.maxHp - target.hp);
      target.hp += healAmount;
      this.game.state.useItem(item.id);
      return `${target.name}の HPが ${healAmount} かいふくした！`;
    }

    if (item.type === 'status_cure' && item.effect.cureStatus) {
      if (target.hp <= 0) {
        return `${target.name}は しんでいる！`;
      }
      const cured = target.statusEffects.filter((s) =>
        item.effect.cureStatus!.includes(s.type)
      );
      if (cured.length === 0) {
        return `しかし なにも おこらなかった！`;
      }
      target.statusEffects = target.statusEffects.filter(
        (s) => !item.effect.cureStatus!.includes(s.type)
      );
      this.game.state.useItem(item.id);
      return `${target.name}の じょうたいが かいふくした！`;
    }

    if (item.type === 'revive') {
      if (target.hp > 0) {
        return `${target.name}は いきている！`;
      }
      const reviveHp = Math.floor(target.maxHp * (item.effect.reviveHpPercent ?? 0.5));
      target.hp = Math.max(1, reviveHp);
      this.game.state.useItem(item.id);
      return `${target.name}は いきかえった！`;
    }

    return 'しかし なにも おこらなかった！';
  }

  private updateCursor(): void {
    if (!this.cursorText) return;
    this.cursorText.x = 16;
    this.cursorText.y = 22 + this.cursorIndex * 28;
  }

  update(delta: number): void {
    const input = this.game.input;
    input.update();

    if (this.phase === 'message') {
      this.messageTimer -= delta;
      if (this.messageTimer <= 0 || input.isActionPressed) {
        this.phase = 'list';
        this.draw();
      }
      input.resetOneShot();
      return;
    }

    if (this.phase === 'target') {
      const members = this.game.state.active;
      const dir = input.directionJustPressed;
      if (dir === 'up' && this.targetCursor > 0) {
        this.targetCursor--;
        this.targetCursorText.y = 66 + this.targetCursor * 32;
      } else if (dir === 'down' && this.targetCursor < members.length - 1) {
        this.targetCursor++;
        this.targetCursorText.y = 66 + this.targetCursor * 32;
      }

      if (input.isActionPressed && this.selectedItemData) {
        const target = members[this.targetCursor];
        const msg = this.applyItemEffect(this.selectedItemData, target);
        this.showMessage(msg);
      }

      if (input.isCancelPressed) {
        this.phase = 'list';
        this.draw();
      }

      input.resetOneShot();
      return;
    }

    // list phase
    const items = this.game.state.items;

    if (items.length > 0) {
      const dir = input.directionJustPressed;
      if (dir === 'up' && this.cursorIndex > 0) {
        this.cursorIndex--;
        this.updateCursor();
      } else if (dir === 'down' && this.cursorIndex < items.length - 1) {
        this.cursorIndex++;
        this.updateCursor();
      }

      if (input.isActionPressed) {
        const selectedItem = items[this.cursorIndex];
        const itemData = this.itemDataMap.get(selectedItem.id);

        if (itemData) {
          if (itemData.type === 'equipment') {
            this.showMessage('そうびメニューから そうびしてください');
          } else if (itemData.type === 'key') {
            this.showMessage('ここでは つかえません');
          } else if (itemData.usableInField) {
            this.selectedItemData = itemData;
            this.drawTargetSelect();
          } else {
            this.showMessage('ここでは つかえません');
          }
        }
      }
    }

    if (input.isCancelPressed) {
      this.onClose();
    }

    input.resetOneShot();
  }
}

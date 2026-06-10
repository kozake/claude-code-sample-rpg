import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';
import type { ItemData } from '../data/types';

interface ShopItem {
  id: string;
  name: string;
  price: number;
}

/**
 * ショップ画面
 * - 買う / 売る / やめる
 */
export class ShopScene extends Scene {
  private phase: 'main' | 'buy' | 'sell' | 'message' = 'main';
  private cursorIndex = 0;
  private cursorText!: Text;
  private items: ShopItem[];
  private itemMaster: Map<string, ItemData>;
  private onClose: () => void;
  private messageTimer = 0;
  private backDraw: (() => void) | null = null;

  constructor(game: Game, items: ShopItem[], itemMaster: Map<string, ItemData>, onClose: () => void) {
    super(game);
    this.items = items;
    this.itemMaster = itemMaster;
    this.onClose = onClose;
  }

  onEnter(): void {
    this.drawMainMenu();
  }

  /** 売却可能な所持アイテム一覧 */
  private getSellableItems(): { id: string; name: string; count: number; sellPrice: number }[] {
    const result: { id: string; name: string; count: number; sellPrice: number }[] = [];
    for (const inv of this.game.state.items) {
      const data = this.itemMaster.get(inv.id);
      if (!data || data.type === 'key' || data.price <= 0) continue;
      result.push({
        id: inv.id,
        name: data.name,
        count: inv.count,
        sellPrice: data.sellPrice ?? Math.max(1, Math.floor(data.price / 2)),
      });
    }
    return result;
  }

  private drawMainMenu(): void {
    this.container.removeChildren();
    this.phase = 'main';
    this.cursorIndex = 0;

    const win = new Window(8, 8, GAME_WIDTH - 16, 100);
    this.container.addChild(win);

    const msgStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });
    const msg = new Text({ text: 'いらっしゃい！\nなにを おもとめですか？', style: msgStyle });
    msg.x = 20;
    msg.y = 20;
    this.container.addChild(msg);

    // メニュー
    const menuWin = new Window(GAME_WIDTH - 120, 110, 108, 90);
    this.container.addChild(menuWin);

    const menuStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });
    const labels = ['かう', 'うる', 'やめる'];
    labels.forEach((label, i) => {
      const text = new Text({ text: label, style: menuStyle });
      text.x = GAME_WIDTH - 96;
      text.y = 120 + i * 26;
      this.container.addChild(text);
    });

    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.CURSOR }),
    });
    this.cursorText.x = GAME_WIDTH - 112;
    this.cursorText.y = 122;
    this.container.addChild(this.cursorText);

    // ゴールド表示
    this.drawGold();
  }

  private drawBuyMenu(): void {
    this.container.removeChildren();
    this.phase = 'buy';
    this.cursorIndex = Math.min(this.cursorIndex, Math.max(0, this.items.length - 1));

    const listH = this.items.length * 28 + 16;
    const win = new Window(8, 8, GAME_WIDTH - 16, Math.min(listH, GAME_HEIGHT - 80));
    this.container.addChild(win);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });
    const priceStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.TEXT_DISABLED });

    this.items.forEach((item, i) => {
      const name = new Text({ text: item.name, style });
      name.x = 36;
      name.y = 18 + i * 28;
      this.container.addChild(name);

      const price = new Text({ text: `${item.price}G`, style: priceStyle });
      price.x = GAME_WIDTH - 60;
      price.y = 18 + i * 28;
      this.container.addChild(price);
    });

    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.CURSOR }),
    });
    this.updateCursor();
    this.container.addChild(this.cursorText);

    this.drawGold();
  }

  private drawSellMenu(): void {
    this.container.removeChildren();
    this.phase = 'sell';

    const sellables = this.getSellableItems();
    if (sellables.length === 0) {
      this.showMessage('うれるものが ないようだね。', () => this.drawMainMenu());
      return;
    }

    this.cursorIndex = Math.min(this.cursorIndex, sellables.length - 1);

    const listH = sellables.length * 28 + 16;
    const win = new Window(8, 8, GAME_WIDTH - 16, Math.min(listH, GAME_HEIGHT - 80));
    this.container.addChild(win);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });
    const priceStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.TEXT_DISABLED });

    sellables.forEach((item, i) => {
      const name = new Text({ text: `${item.name}  x${item.count}`, style });
      name.x = 36;
      name.y = 18 + i * 28;
      this.container.addChild(name);

      const price = new Text({ text: `${item.sellPrice}G`, style: priceStyle });
      price.x = GAME_WIDTH - 60;
      price.y = 18 + i * 28;
      this.container.addChild(price);
    });

    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.CURSOR }),
    });
    this.updateCursor();
    this.container.addChild(this.cursorText);

    this.drawGold();
  }

  private drawGold(): void {
    const goldWin = new Window(8, GAME_HEIGHT - 48, 120, 36);
    this.container.addChild(goldWin);

    const goldText = new Text({
      text: `${this.game.state.gold} G`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fill: COLORS.TEXT }),
    });
    goldText.x = 20;
    goldText.y = GAME_HEIGHT - 40;
    this.container.addChild(goldText);
  }

  /** 一時メッセージ表示後に指定画面へ戻る */
  private showMessage(msg: string, back: () => void): void {
    this.phase = 'message';
    this.messageTimer = 60; // 約1秒
    this.backDraw = back;

    this.container.removeChildren();
    const win = new Window(8, GAME_HEIGHT / 2 - 30, GAME_WIDTH - 16, 60);
    this.container.addChild(win);

    const text = new Text({
      text: msg,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    text.x = 20;
    text.y = GAME_HEIGHT / 2 - 16;
    this.container.addChild(text);
  }

  private updateCursor(): void {
    if (this.phase === 'main') {
      this.cursorText.x = GAME_WIDTH - 112;
      this.cursorText.y = 122 + this.cursorIndex * 26;
    } else {
      this.cursorText.x = 16;
      this.cursorText.y = 22 + this.cursorIndex * 28;
    }
  }

  update(delta: number): void {
    const input = this.game.input;
    input.update();

    if (this.phase === 'message') {
      this.messageTimer -= delta;
      if (this.messageTimer <= 0 || input.isActionPressed) {
        const back = this.backDraw;
        this.backDraw = null;
        back?.();
      }
      input.resetOneShot();
      return;
    }

    const maxIdx =
      this.phase === 'main' ? 2 :
      this.phase === 'buy' ? this.items.length - 1 :
      this.getSellableItems().length - 1;

    const dir = input.directionJustPressed;
    if (dir === 'up' && this.cursorIndex > 0) {
      this.cursorIndex--;
      this.game.audio.playSeOrSynth('cursor');
      this.updateCursor();
    } else if (dir === 'down' && this.cursorIndex < maxIdx) {
      this.cursorIndex++;
      this.game.audio.playSeOrSynth('cursor');
      this.updateCursor();
    }

    if (input.isActionPressed) {
      if (this.phase === 'main') {
        this.game.audio.playSeOrSynth('confirm');
        switch (this.cursorIndex) {
          case 0:
            this.cursorIndex = 0;
            this.drawBuyMenu();
            break;
          case 1:
            this.cursorIndex = 0;
            this.drawSellMenu();
            break;
          case 2:
            this.onClose();
            break;
        }
      } else if (this.phase === 'buy') {
        this.tryBuy(this.cursorIndex);
      } else if (this.phase === 'sell') {
        this.trySell(this.cursorIndex);
      }
    }

    if (input.isCancelPressed) {
      this.game.audio.playSeOrSynth('cancel');
      if (this.phase === 'buy' || this.phase === 'sell') {
        this.drawMainMenu();
      } else {
        this.onClose();
      }
    }

    input.resetOneShot();
  }

  private tryBuy(index: number): void {
    const item = this.items[index];
    if (!item) return;

    if (this.game.state.gold < item.price) {
      this.game.audio.playSeOrSynth('cancel');
      this.showMessage('おかねが たりないよ！', () => this.drawBuyMenu());
      return;
    }

    if (!this.game.state.addItem(item.id)) {
      this.game.audio.playSeOrSynth('cancel');
      this.showMessage('もちものが いっぱいだ！', () => this.drawBuyMenu());
      return;
    }

    this.game.state.gold -= item.price;
    this.game.audio.playSeOrSynth('confirm');
    this.showMessage(`${item.name}を かった！\nまいど ありがとう！`, () => this.drawBuyMenu());
  }

  private trySell(index: number): void {
    const sellables = this.getSellableItems();
    const item = sellables[index];
    if (!item) return;

    this.game.state.useItem(item.id);
    this.game.state.gold += item.sellPrice;
    this.game.audio.playSeOrSynth('confirm');
    this.showMessage(`${item.name}を ${item.sellPrice}Gで かいとった！`, () => this.drawSellMenu());
  }
}

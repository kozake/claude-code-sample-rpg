import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';

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
  private phase: 'main' | 'buy' | 'sell' = 'main';
  private cursorIndex = 0;
  private cursorText!: Text;
  private items: ShopItem[];
  private onClose: () => void;

  constructor(game: Game, items: ShopItem[], onClose: () => void) {
    super(game);
    this.items = items;
    this.onClose = onClose;
  }

  onEnter(): void {
    this.drawMainMenu();
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
    this.cursorIndex = 0;

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
    this.cursorText.x = 16;
    this.cursorText.y = 22;
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

  private updateCursor(): void {
    if (this.phase === 'main') {
      this.cursorText.x = GAME_WIDTH - 112;
      this.cursorText.y = 122 + this.cursorIndex * 26;
    } else if (this.phase === 'buy') {
      this.cursorText.x = 16;
      this.cursorText.y = 22 + this.cursorIndex * 28;
    }
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    const maxIdx = this.phase === 'main' ? 2 : this.items.length - 1;

    if (input.direction === 'up' && this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateCursor();
    } else if (input.direction === 'down' && this.cursorIndex < maxIdx) {
      this.cursorIndex++;
      this.updateCursor();
    }

    if (input.isActionPressed) {
      if (this.phase === 'main') {
        switch (this.cursorIndex) {
          case 0: this.drawBuyMenu(); break;
          case 1: break; // うる: Phase後半で実装
          case 2: this.onClose(); break;
        }
      } else if (this.phase === 'buy') {
        this.tryBuy(this.cursorIndex);
      }
    }

    if (input.isCancelPressed) {
      if (this.phase === 'buy') {
        this.drawMainMenu();
      } else {
        this.onClose();
      }
    }

    input.resetOneShot();
  }

  private tryBuy(index: number): void {
    const item = this.items[index];
    if (this.game.state.gold >= item.price) {
      this.game.state.gold -= item.price;
      this.game.state.addItem(item.id);
      this.drawBuyMenu(); // ゴールド表示更新
    }
  }
}

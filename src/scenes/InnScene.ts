import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { ChoiceWindow } from '../ui/ChoiceWindow';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';

/**
 * 宿屋シーン
 * - HP/MP全回復（ゴールド消費）
 */
export class InnScene extends Scene {
  private price: number;
  private onClose: () => void;
  private choiceWindow = new ChoiceWindow();
  private phase: 'ask' | 'stay' | 'done' = 'ask';
  private msgText!: Text;

  constructor(game: Game, price: number, onClose: () => void) {
    super(game);
    this.price = price;
    this.onClose = onClose;
  }

  onEnter(): void {
    const win = new Window(8, 8, GAME_WIDTH - 16, 80);
    this.container.addChild(win);

    this.msgText = new Text({
      text: `ひとばん ${this.price}ゴールドですが\nおとまりに なりますか？`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    this.msgText.x = 20;
    this.msgText.y = 20;
    this.container.addChild(this.msgText);

    this.container.addChild(this.choiceWindow.container);
    this.choiceWindow.show(['はい', 'いいえ'], (idx) => {
      if (idx === 0) {
        this.tryStay();
      } else {
        this.msgText.text = 'またの おこしを おまちしています。';
        this.phase = 'done';
      }
    });

    // ゴールド表示
    const goldWin = new Window(8, GAME_HEIGHT - 48, 120, 36);
    this.container.addChild(goldWin);
    const gold = new Text({
      text: `${this.game.state.gold} G`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fill: COLORS.TEXT }),
    });
    gold.x = 20;
    gold.y = GAME_HEIGHT - 40;
    this.container.addChild(gold);
  }

  private tryStay(): void {
    if (this.game.state.gold < this.price) {
      this.msgText.text = 'おかねが たりないようです...';
      this.phase = 'done';
      return;
    }

    this.game.state.gold -= this.price;

    // HP/MP全回復
    for (const m of this.game.state.active) {
      m.hp = m.maxHp;
      m.mp = m.maxMp;
      m.statusEffects = [];
    }
    for (const m of this.game.state.reserve) {
      m.hp = m.maxHp;
      m.mp = m.maxMp;
      m.statusEffects = [];
    }

    this.msgText.text = 'おはようございます。\nゆっくり おやすみに なれましたか？';
    this.phase = 'done';
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    if (this.choiceWindow.isVisible) {
      this.choiceWindow.handleInput(input.direction, input.isActionPressed);
    } else if (this.phase === 'done' && input.isActionPressed) {
      this.onClose();
    }

    input.resetOneShot();
  }
}

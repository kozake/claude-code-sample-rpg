import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';
import type { PartyMember } from '../data/types';

/**
 * ステータス表示画面
 * - パーティメンバー選択 → 詳細表示
 */
export class StatusScene extends Scene {
  private cursorIndex = 0;
  private cursorText!: Text;
  private members: PartyMember[];
  private detailMode = false;
  private onClose: () => void;

  constructor(game: Game, onClose: () => void) {
    super(game);
    this.members = game.state.active;
    this.onClose = onClose;
  }

  onEnter(): void {
    this.drawMemberList();
  }

  private drawMemberList(): void {
    this.container.removeChildren();
    this.detailMode = false;

    const win = new Window(8, 8, GAME_WIDTH - 16, this.members.length * 80 + 16);
    this.container.addChild(win);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });
    const subStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.TEXT_DISABLED });

    this.members.forEach((m, i) => {
      const y = 20 + i * 80;

      const name = new Text({ text: `${m.name}  Lv.${m.level}`, style });
      name.x = 36;
      name.y = y;
      this.container.addChild(name);

      const hp = new Text({
        text: `HP ${m.hp}/${m.maxHp}  MP ${m.mp}/${m.maxMp}`,
        style: subStyle,
      });
      hp.x = 36;
      hp.y = y + 20;
      this.container.addChild(hp);

      const stats = new Text({
        text: `こうげき ${m.attack}  しゅび ${m.defense}  すばやさ ${m.speed}`,
        style: subStyle,
      });
      stats.x = 36;
      stats.y = y + 38;
      this.container.addChild(stats);

      const expText = new Text({
        text: `EXP ${m.exp}`,
        style: subStyle,
      });
      expText.x = 36;
      expText.y = y + 54;
      this.container.addChild(expText);
    });

    // カーソル
    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.CURSOR }),
    });
    this.updateCursor();
    this.container.addChild(this.cursorText);

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

  private updateCursor(): void {
    this.cursorText.x = 16;
    this.cursorText.y = 24 + this.cursorIndex * 80;
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    if (input.direction === 'up' && this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateCursor();
    } else if (input.direction === 'down' && this.cursorIndex < this.members.length - 1) {
      this.cursorIndex++;
      this.updateCursor();
    }

    if (input.isCancelPressed) {
      this.onClose();
    }

    input.resetOneShot();
  }
}

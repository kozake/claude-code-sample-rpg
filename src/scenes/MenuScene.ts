import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';

const MENU_COMMANDS = [
  { id: 'status', label: 'つよさ' },
  { id: 'spell', label: 'じゅもん' },
  { id: 'item', label: 'どうぐ' },
  { id: 'equip', label: 'そうび' },
  { id: 'order', label: 'ならびかえ' },
  { id: 'config', label: 'さくせん' },
] as const;

type MenuCommand = (typeof MENU_COMMANDS)[number]['id'];

/**
 * DQ風コマンドメニュー
 * - フィールド上にオーバーレイ表示
 * - つよさ/じゅもん/どうぐ/そうび/ならびかえ/さくせん
 */
export class MenuScene extends Scene {
  private cursorIndex = 0;
  private cursorText!: Text;
  private onClose: () => void;
  private onCommand?: (cmd: MenuCommand) => void;

  constructor(game: Game, onClose: () => void, onCommand?: (cmd: MenuCommand) => void) {
    super(game);
    this.onClose = onClose;
    this.onCommand = onCommand;
  }

  onEnter(): void {
    // コマンドウィンドウ（右上）
    const winW = 130;
    const winH = MENU_COMMANDS.length * 26 + 16;
    const winX = GAME_WIDTH - winW - 8;
    const winY = 8;

    const win = new Window(winX, winY, winW, winH);
    this.container.addChild(win);

    const style = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 14,
      fill: COLORS.TEXT,
    });

    MENU_COMMANDS.forEach((cmd, i) => {
      const text = new Text({ text: cmd.label, style });
      text.x = winX + 28;
      text.y = winY + 10 + i * 26;
      this.container.addChild(text);
    });

    // カーソル
    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.CURSOR }),
    });
    this.updateCursor();
    this.container.addChild(this.cursorText);

    // ゴールド表示ウィンドウ（左下）
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
    const winX = GAME_WIDTH - 130 - 8;
    this.cursorText.x = winX + 10;
    this.cursorText.y = 8 + 12 + this.cursorIndex * 26;
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    if (input.direction === 'up' && this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateCursor();
    } else if (input.direction === 'down' && this.cursorIndex < MENU_COMMANDS.length - 1) {
      this.cursorIndex++;
      this.updateCursor();
    }

    if (input.isActionPressed) {
      const cmd = MENU_COMMANDS[this.cursorIndex];
      this.onCommand?.(cmd.id);
    }

    if (input.isCancelPressed || input.isMenuPressed) {
      this.onClose();
    }

    input.resetOneShot();
  }
}

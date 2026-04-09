import { Container, Text, TextStyle } from 'pixi.js';
import { Window } from './Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';

/**
 * はい/いいえ等の選択肢ウィンドウ
 */
export class ChoiceWindow {
  readonly container = new Container();
  private cursorIndex = 0;
  private cursorText!: Text;
  private choices: string[] = [];
  private _isVisible = false;
  private onSelect?: (index: number) => void;

  show(choices: string[], onSelect: (index: number) => void): void {
    this.choices = choices;
    this.onSelect = onSelect;
    this.cursorIndex = 0;
    this._isVisible = true;
    this.container.visible = true;
    this.draw();
  }

  hide(): void {
    this._isVisible = false;
    this.container.visible = false;
    this.container.removeChildren();
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  private draw(): void {
    this.container.removeChildren();

    const winW = 100;
    const winH = this.choices.length * 26 + 12;
    const winX = GAME_WIDTH - winW - 16;
    const winY = GAME_HEIGHT - 120 - winH;

    const win = new Window(winX, winY, winW, winH);
    this.container.addChild(win);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });

    this.choices.forEach((label, i) => {
      const text = new Text({ text: label, style });
      text.x = winX + 24;
      text.y = winY + 8 + i * 26;
      this.container.addChild(text);
    });

    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.CURSOR, stroke: { color: 0x442200, width: 1 } }),
    });
    this.updateCursor();
    this.container.addChild(this.cursorText);
  }

  private updateCursor(): void {
    const winX = GAME_WIDTH - 100 - 16;
    const winY = GAME_HEIGHT - 120 - (this.choices.length * 26 + 12);
    this.cursorText.x = winX + 8;
    this.cursorText.y = winY + 10 + this.cursorIndex * 26;
  }

  handleInput(direction: string | null, actionPressed: boolean): void {
    if (!this._isVisible) return;

    if (direction === 'up' && this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateCursor();
    } else if (direction === 'down' && this.cursorIndex < this.choices.length - 1) {
      this.cursorIndex++;
      this.updateCursor();
    }

    if (actionPressed) {
      this.onSelect?.(this.cursorIndex);
      this.hide();
    }
  }
}

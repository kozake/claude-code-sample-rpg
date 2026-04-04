import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';

/**
 * アイテム一覧画面
 * - 所持アイテム表示
 * - 使う / 捨てる（Phase 4以降で拡張）
 */
export class ItemScene extends Scene {
  private cursorIndex = 0;
  private cursorText!: Text;
  private onClose: () => void;

  constructor(game: Game, onClose: () => void) {
    super(game);
    this.onClose = onClose;
  }

  onEnter(): void {
    this.draw();
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
        const text = new Text({
          text: `${item.id}  x${item.count}`,
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
      text: 'Bボタン: もどる',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: COLORS.TEXT_DISABLED }),
    });
    hint.anchor.set(0.5);
    hint.x = GAME_WIDTH / 2;
    hint.y = GAME_HEIGHT - 24;
    this.container.addChild(hint);
  }

  private updateCursor(): void {
    if (!this.cursorText) return;
    this.cursorText.x = 16;
    this.cursorText.y = 22 + this.cursorIndex * 28;
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

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
    }

    if (input.isCancelPressed) {
      this.onClose();
    }

    input.resetOneShot();
  }
}

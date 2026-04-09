import { Container, Graphics, Text } from 'pixi.js';
import { GAME_WIDTH, COLORS, FONT_FAMILY } from '../constants';
import type { InputManager } from '../systems/InputManager';

const BTN_WIDTH = 52;
const BTN_HEIGHT = 28;
const MARGIN = 8;

/**
 * メニューボタン（リッチデザイン版）
 */
export class MenuButton {
  readonly container = new Container();

  constructor(input: InputManager) {
    const btn = new Graphics();
    const x = GAME_WIDTH - BTN_WIDTH - MARGIN;
    const y = MARGIN;

    // ドロップシャドウ
    btn.roundRect(x + 1, y + 1, BTN_WIDTH, BTN_HEIGHT, 5)
      .fill({ color: 0x000000, alpha: 0.3 });

    // 背景
    btn.roundRect(x, y, BTN_WIDTH, BTN_HEIGHT, 5)
      .fill({ color: COLORS.WINDOW_BG, alpha: 0.8 });

    // 上部ハイライト
    btn.roundRect(x + 1, y + 1, BTN_WIDTH - 2, BTN_HEIGHT * 0.4, 4)
      .fill({ color: 0xffffff, alpha: 0.06 });

    // 枠線
    btn.roundRect(x, y, BTN_WIDTH, BTN_HEIGHT, 5)
      .stroke({ color: COLORS.WINDOW_BORDER, alpha: 0.5, width: 1 });

    const text = new Text({
      text: 'MENU',
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        fill: COLORS.TEXT,
      },
    });
    text.x = x + BTN_WIDTH / 2;
    text.y = y + BTN_HEIGHT / 2;
    text.anchor.set(0.5);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = { contains: (px: number, py: number) => px >= x - 4 && px <= x + BTN_WIDTH + 4 && py >= y - 4 && py <= y + BTN_HEIGHT + 4 };

    btn.on('pointerdown', () => input.setTouchMenu());

    this.container.addChild(btn);
    this.container.addChild(text);
  }
}

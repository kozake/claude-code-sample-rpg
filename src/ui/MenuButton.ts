import { Container, Graphics, Text } from 'pixi.js';
import { GAME_WIDTH, COLORS, FONT_FAMILY } from '../constants';
import type { InputManager } from '../systems/InputManager';

const BTN_WIDTH = 48;
const BTN_HEIGHT = 28;
const MARGIN = 8;

/**
 * メニューボタン（右上に配置）
 */
export class MenuButton {
  readonly container = new Container();

  constructor(input: InputManager) {
    const btn = new Graphics();
    const x = GAME_WIDTH - BTN_WIDTH - MARGIN;
    const y = MARGIN;

    btn.roundRect(x, y, BTN_WIDTH, BTN_HEIGHT, 4).fill({ color: COLORS.WINDOW_BG, alpha: 0.7 });
    btn.roundRect(x, y, BTN_WIDTH, BTN_HEIGHT, 4).stroke({ color: COLORS.WHITE, alpha: 0.5, width: 1 });

    const text = new Text({
      text: 'MENU',
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        fill: COLORS.WHITE,
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

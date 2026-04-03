import { Container, Graphics, Text } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { InputManager } from '../systems/InputManager';

const BTN_RADIUS = 24;
const MARGIN = 20;

/**
 * Aボタン（決定）とBボタン（キャンセル）
 * 右下に配置、ゲーム画面上にオーバーレイ
 */
export class ActionButton {
  readonly container = new Container();

  constructor(input: InputManager) {
    const baseX = GAME_WIDTH - MARGIN - BTN_RADIUS * 2;
    const baseY = GAME_HEIGHT - MARGIN - BTN_RADIUS * 2 - 10;

    // Aボタン（決定）- 右上
    this.createCircleButton(
      baseX + BTN_RADIUS + 20,
      baseY - 10,
      'A',
      0x44aa44,
      () => input.setTouchAction()
    );

    // Bボタン（キャンセル）- 左下
    this.createCircleButton(
      baseX - 10,
      baseY + BTN_RADIUS + 20,
      'B',
      0xcc4444,
      () => input.setTouchCancel()
    );
  }

  private createCircleButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onPress: () => void
  ): void {
    const btn = new Graphics();
    btn.circle(x, y, BTN_RADIUS).fill({ color, alpha: 0.35 });
    btn.circle(x, y, BTN_RADIUS).stroke({ color: COLORS.WHITE, alpha: 0.5, width: 1.5 });

    const text = new Text({
      text: label,
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 16,
        fill: COLORS.WHITE,
        fontWeight: 'bold',
      },
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = { contains: (px: number, py: number) => Math.hypot(px - x, py - y) <= BTN_RADIUS + 8 };

    btn.on('pointerdown', () => onPress());

    this.container.addChild(btn);
    this.container.addChild(text);
  }
}

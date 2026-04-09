import { Container, Graphics, Text } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { InputManager } from '../systems/InputManager';

const BTN_RADIUS = 24;
const MARGIN = 20;

/**
 * A/Bボタン（リッチデザイン版）
 * - グラデーション背景 + グロウ効果
 * - 影付きテキスト
 */
export class ActionButton {
  readonly container = new Container();

  constructor(input: InputManager) {
    const baseX = GAME_WIDTH - MARGIN - BTN_RADIUS * 2;
    const baseY = GAME_HEIGHT - MARGIN - BTN_RADIUS * 2 - 10;

    // Aボタン（決定）- 緑系
    this.createCircleButton(
      baseX + BTN_RADIUS + 20,
      baseY - 10,
      'A',
      0x208840,
      0x30c060,
      () => input.setTouchAction()
    );

    // Bボタン（キャンセル）- 赤系
    this.createCircleButton(
      baseX - 10,
      baseY + BTN_RADIUS + 20,
      'B',
      0x882020,
      0xc04040,
      () => input.setTouchCancel()
    );
  }

  private createCircleButton(
    x: number,
    y: number,
    label: string,
    colorDark: number,
    colorLight: number,
    onPress: () => void
  ): void {
    const btn = new Graphics();

    // ドロップシャドウ
    btn.circle(x + 1, y + 2, BTN_RADIUS)
      .fill({ color: 0x000000, alpha: 0.3 });

    // ボタン背景
    btn.circle(x, y, BTN_RADIUS)
      .fill({ color: colorDark, alpha: 0.5 });

    // 上部ハイライト（立体感）
    btn.ellipse(x, y - BTN_RADIUS * 0.2, BTN_RADIUS * 0.7, BTN_RADIUS * 0.4)
      .fill({ color: colorLight, alpha: 0.15 });

    // 外枠
    btn.circle(x, y, BTN_RADIUS)
      .stroke({ color: colorLight, alpha: 0.5, width: 1.5 });

    // 内側グロウ
    btn.circle(x, y, BTN_RADIUS - 3)
      .stroke({ color: colorLight, alpha: 0.15, width: 1 });

    // テキスト影
    const shadowText = new Text({
      text: label,
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 16,
        fill: 0x000000,
        fontWeight: 'bold',
      },
    });
    shadowText.anchor.set(0.5);
    shadowText.x = x + 0.5;
    shadowText.y = y + 1;
    shadowText.alpha = 0.4;

    // テキスト本体
    const text = new Text({
      text: label,
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 16,
        fill: 0xe8e8f8,
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
    this.container.addChild(shadowText);
    this.container.addChild(text);
  }
}

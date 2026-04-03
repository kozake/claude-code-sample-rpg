import { Container, Graphics } from 'pixi.js';
import { COLORS } from '../constants';

/**
 * DQ風ウィンドウ（再利用可能コンポーネント）
 * - 角丸の青背景 + 白枠
 */
export class Window extends Container {
  constructor(x: number, y: number, width: number, height: number) {
    super();

    const bg = new Graphics();
    bg.roundRect(x, y, width, height, 4)
      .fill({ color: COLORS.WINDOW_BG, alpha: 0.92 });
    bg.roundRect(x, y, width, height, 4)
      .stroke({ color: COLORS.WINDOW_BORDER, width: 2 });

    this.addChild(bg);
  }
}

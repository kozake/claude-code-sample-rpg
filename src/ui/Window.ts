import { Container, Graphics } from 'pixi.js';
import { COLORS } from '../constants';

/**
 * DQ風ウィンドウ（再利用可能コンポーネント）
 * - 角丸の青背景 + 二重枠（外:白, 内:明るい青）
 * - グラデーション風の内側シャドウ
 */
export class Window extends Container {
  constructor(x: number, y: number, width: number, height: number) {
    super();

    const bg = new Graphics();

    // 外枠の影（立体感）
    bg.roundRect(x + 1, y + 1, width, height, 4)
      .fill({ color: 0x000011, alpha: 0.5 });

    // メイン背景（濃い青）
    bg.roundRect(x, y, width, height, 4)
      .fill({ color: COLORS.WINDOW_BG, alpha: 0.95 });

    // 上部にハイライト（グラデーション風）
    bg.roundRect(x + 2, y + 2, width - 4, Math.min(height * 0.3, 12), 3)
      .fill({ color: 0x1a1a66, alpha: 0.4 });

    // 内枠（明るい青）
    bg.roundRect(x + 3, y + 3, width - 6, height - 6, 3)
      .stroke({ color: 0x4466aa, width: 1, alpha: 0.5 });

    // 外枠（白）
    bg.roundRect(x, y, width, height, 4)
      .stroke({ color: COLORS.WINDOW_BORDER, width: 2 });

    this.addChild(bg);
  }
}

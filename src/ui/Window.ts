import { Container, Graphics } from 'pixi.js';
import { COLORS } from '../constants';

/**
 * DQ風ウィンドウ（リッチデザイン版）
 * - 多層グラデーション背景
 * - 二重枠 + 角装飾
 * - 内側グロウ + ハイライト
 */
export class Window extends Container {
  constructor(x: number, y: number, width: number, height: number) {
    super();

    const bg = new Graphics();
    const r = 6; // 角丸半径

    // ドロップシャドウ（深い影）
    bg.roundRect(x + 2, y + 2, width, height, r)
      .fill({ color: 0x000008, alpha: 0.7 });

    // 外枠背景（暗い縁取り）
    bg.roundRect(x - 1, y - 1, width + 2, height + 2, r + 1)
      .fill({ color: COLORS.WINDOW_BORDER_OUTER, alpha: 0.9 });

    // メイン背景グラデーション（上から下へ）
    const gradSteps = 8;
    const innerX = x + 2;
    const innerY = y + 2;
    const innerW = width - 4;
    const innerH = height - 4;

    // クリッピング用の背景ベース
    bg.roundRect(innerX, innerY, innerW, innerH, r - 1)
      .fill({ color: COLORS.WINDOW_BG_DARK, alpha: 1 });

    // 上部ハイライト帯
    const highlightH = Math.min(innerH * 0.35, 20);
    bg.roundRect(innerX + 1, innerY + 1, innerW - 2, highlightH, r - 2)
      .fill({ color: COLORS.WINDOW_HIGHLIGHT, alpha: 0.5 });

    // 内側の微妙なグロウ（四辺）
    bg.roundRect(innerX + 2, innerY + 2, innerW - 4, innerH - 4, r - 2)
      .stroke({ color: COLORS.WINDOW_INNER_GLOW, width: 1, alpha: 0.4 });

    // 内枠ライン（明るい青）
    bg.roundRect(x + 3, y + 3, width - 6, height - 6, r - 1)
      .stroke({ color: 0x5060b0, width: 1, alpha: 0.6 });

    // 外枠メインボーダー
    bg.roundRect(x, y, width, height, r)
      .stroke({ color: COLORS.WINDOW_BORDER, width: 2 });

    // 角装飾（四隅に小さなアクセント）
    const cornerSize = 4;
    const corners = [
      [x + 2, y + 2],
      [x + width - 2 - cornerSize, y + 2],
      [x + 2, y + height - 2 - cornerSize],
      [x + width - 2 - cornerSize, y + height - 2 - cornerSize],
    ];
    for (const [cx, cy] of corners) {
      bg.rect(cx, cy, cornerSize, cornerSize)
        .fill({ color: COLORS.WINDOW_BORDER, alpha: 0.4 });
    }

    this.addChild(bg);
  }
}

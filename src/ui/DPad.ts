import { Container, Graphics, FederatedPointerEvent } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants';
import type { InputManager, Direction } from '../systems/InputManager';

const PAD_SIZE = 120;
const BTN_SIZE = 40;
const MARGIN = 12;

/**
 * 仮想十字キー（リッチデザイン版）
 * - グラスモーフィズム風の半透明デザイン
 * - グラデーション + 内側グロウ
 */
export class DPad {
  readonly container = new Container();
  private input: InputManager;

  constructor(input: InputManager) {
    this.input = input;

    const baseX = MARGIN;
    const baseY = GAME_HEIGHT - PAD_SIZE - MARGIN;
    this.container.x = baseX;
    this.container.y = baseY;

    // ベースプレート（薄い円形シャドウ）
    const plate = new Graphics();
    plate.circle(PAD_SIZE / 2, PAD_SIZE / 2, PAD_SIZE * 0.42)
      .fill({ color: 0x000020, alpha: 0.2 });
    this.container.addChild(plate);

    const cx = PAD_SIZE / 2 - BTN_SIZE / 2;
    const cy = PAD_SIZE / 2 - BTN_SIZE / 2;

    this.createButton(cx, 0, 'up');
    this.createButton(cx, PAD_SIZE - BTN_SIZE, 'down');
    this.createButton(0, cy, 'left');
    this.createButton(PAD_SIZE - BTN_SIZE, cy, 'right');
  }

  private createButton(x: number, y: number, dir: Direction): void {
    const btn = new Graphics();

    // ボタン背景（グラデーション風）
    btn.roundRect(x, y, BTN_SIZE, BTN_SIZE, 6)
      .fill({ color: 0x101030, alpha: 0.45 });
    // 上端ハイライト
    btn.roundRect(x + 1, y + 1, BTN_SIZE - 2, BTN_SIZE * 0.4, 5)
      .fill({ color: 0xffffff, alpha: 0.08 });
    // 外枠
    btn.roundRect(x, y, BTN_SIZE, BTN_SIZE, 6)
      .stroke({ color: 0xb0b8d0, alpha: 0.4, width: 1.5 });

    // 矢印
    const arrow = new Graphics();
    const cx = x + BTN_SIZE / 2;
    const cy = y + BTN_SIZE / 2;
    const s = 7;

    // 矢印の影
    arrow.setStrokeStyle({ width: 4, color: 0x000000, alpha: 0.3 });
    this.drawArrowPath(arrow, cx + 0.5, cy + 0.5, s, dir);
    arrow.stroke();

    // 矢印本体
    arrow.setStrokeStyle({ width: 2.5, color: 0xd0d8f0, alpha: 0.9 });
    this.drawArrowPath(arrow, cx, cy, s, dir);
    arrow.stroke();

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = { contains: (px: number, py: number) => px >= x - 4 && px <= x + BTN_SIZE + 4 && py >= y - 4 && py <= y + BTN_SIZE + 4 };

    btn.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.input.setTouchDirection(dir);
    });
    btn.on('pointerup', () => this.input.setTouchDirection(null));
    btn.on('pointerupoutside', () => this.input.setTouchDirection(null));

    this.container.addChild(btn);
    this.container.addChild(arrow);
  }

  private drawArrowPath(g: Graphics, cx: number, cy: number, s: number, dir: Direction): void {
    switch (dir) {
      case 'up':
        g.moveTo(cx, cy - s).lineTo(cx - s, cy + s * 0.4);
        g.moveTo(cx, cy - s).lineTo(cx + s, cy + s * 0.4);
        break;
      case 'down':
        g.moveTo(cx, cy + s).lineTo(cx - s, cy - s * 0.4);
        g.moveTo(cx, cy + s).lineTo(cx + s, cy - s * 0.4);
        break;
      case 'left':
        g.moveTo(cx - s, cy).lineTo(cx + s * 0.4, cy - s);
        g.moveTo(cx - s, cy).lineTo(cx + s * 0.4, cy + s);
        break;
      case 'right':
        g.moveTo(cx + s, cy).lineTo(cx - s * 0.4, cy - s);
        g.moveTo(cx + s, cy).lineTo(cx - s * 0.4, cy + s);
        break;
    }
  }
}

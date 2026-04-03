import { Container, Graphics, FederatedPointerEvent } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../constants';
import type { InputManager, Direction } from '../systems/InputManager';

const PAD_SIZE = 120;
const BTN_SIZE = 40;
const MARGIN = 12;

/**
 * 仮想十字キー（左下に配置）
 * ゲーム画面上にオーバーレイ
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

    // 中央を基準にした各方向ボタン位置
    const cx = PAD_SIZE / 2 - BTN_SIZE / 2;
    const cy = PAD_SIZE / 2 - BTN_SIZE / 2;

    this.createButton(cx, 0, 'up');              // 上
    this.createButton(cx, PAD_SIZE - BTN_SIZE, 'down');  // 下
    this.createButton(0, cy, 'left');            // 左
    this.createButton(PAD_SIZE - BTN_SIZE, cy, 'right'); // 右
  }

  private createButton(x: number, y: number, dir: Direction): void {
    const btn = new Graphics();
    btn.roundRect(x, y, BTN_SIZE, BTN_SIZE, 4).fill({ color: COLORS.WHITE, alpha: 0.25 });
    btn.roundRect(x, y, BTN_SIZE, BTN_SIZE, 4).stroke({ color: COLORS.WHITE, alpha: 0.5, width: 1 });

    // 矢印記号
    const arrow = new Graphics();
    const cx = x + BTN_SIZE / 2;
    const cy = y + BTN_SIZE / 2;
    const s = 8;

    arrow.setStrokeStyle({ width: 3, color: COLORS.WHITE, alpha: 0.8 });
    switch (dir) {
      case 'up':
        arrow.moveTo(cx, cy - s).lineTo(cx - s, cy + s / 2);
        arrow.moveTo(cx, cy - s).lineTo(cx + s, cy + s / 2);
        break;
      case 'down':
        arrow.moveTo(cx, cy + s).lineTo(cx - s, cy - s / 2);
        arrow.moveTo(cx, cy + s).lineTo(cx + s, cy - s / 2);
        break;
      case 'left':
        arrow.moveTo(cx - s, cy).lineTo(cx + s / 2, cy - s);
        arrow.moveTo(cx - s, cy).lineTo(cx + s / 2, cy + s);
        break;
      case 'right':
        arrow.moveTo(cx + s, cy).lineTo(cx - s / 2, cy - s);
        arrow.moveTo(cx + s, cy).lineTo(cx - s / 2, cy + s);
        break;
    }
    arrow.stroke();

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    // ヒットエリアを広げる
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
}

import { Container, Graphics, Text } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';

const WINDOW_HEIGHT = 96;
const PADDING = 12;
const LINE_HEIGHT = 20;
const MAX_LINES = 3;

/**
 * DQ風メッセージウィンドウ（リッチデザイン版）
 * - 画面下部に表示
 * - 1文字ずつ表示（タイプライター効果）
 * - タップ/決定で次のメッセージへ
 */
export class MessageWindow {
  readonly container = new Container();
  private textDisplay: Text;
  private indicator: Text;
  private messageQueue: string[] = [];
  private currentText = '';
  private displayedChars = 0;
  private charTimer = 0;
  private charSpeed = 2;
  private isComplete = false;
  private _isVisible = false;
  private onFinish?: () => void;

  constructor() {
    const bg = new Graphics();
    const y = GAME_HEIGHT - WINDOW_HEIGHT - 8;
    const x = 8;
    const w = GAME_WIDTH - 16;
    const h = WINDOW_HEIGHT;
    const r = 6;

    // ドロップシャドウ
    bg.roundRect(x + 2, y + 2, w, h, r)
      .fill({ color: 0x000008, alpha: 0.6 });

    // 外枠背景
    bg.roundRect(x - 1, y - 1, w + 2, h + 2, r + 1)
      .fill({ color: COLORS.WINDOW_BORDER_OUTER, alpha: 0.8 });

    // メイン背景
    bg.roundRect(x + 2, y + 2, w - 4, h - 4, r - 1)
      .fill({ color: COLORS.WINDOW_BG_DARK, alpha: 0.95 });

    // 上部ハイライト
    bg.roundRect(x + 3, y + 3, w - 6, 12, r - 2)
      .fill({ color: COLORS.WINDOW_HIGHLIGHT, alpha: 0.4 });

    // 内枠
    bg.roundRect(x + 3, y + 3, w - 6, h - 6, r - 1)
      .stroke({ color: 0x5060b0, width: 1, alpha: 0.5 });

    // 外枠ボーダー
    bg.roundRect(x, y, w, h, r)
      .stroke({ color: COLORS.WINDOW_BORDER, width: 2 });

    this.textDisplay = new Text({
      text: '',
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        fill: COLORS.TEXT,
        wordWrap: true,
        wordWrapWidth: w - PADDING * 2 - 8,
        lineHeight: LINE_HEIGHT,
      },
    });
    this.textDisplay.x = x + PADDING + 2;
    this.textDisplay.y = y + PADDING;

    // ▼ 続きインジケーター
    this.indicator = new Text({
      text: '▼',
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        fill: COLORS.CURSOR,
      },
    });
    this.indicator.x = GAME_WIDTH - 28;
    this.indicator.y = GAME_HEIGHT - 20;
    this.indicator.visible = false;

    this.container.addChild(bg);
    this.container.addChild(this.textDisplay);
    this.container.addChild(this.indicator);
    this.container.visible = false;
  }

  show(messages: string[], onFinish?: () => void): void {
    this.messageQueue = [...messages];
    this.onFinish = onFinish;
    this._isVisible = true;
    this.container.visible = true;
    this.nextMessage();
  }

  private nextMessage(): void {
    if (this.messageQueue.length === 0) {
      this.hide();
      this.onFinish?.();
      return;
    }
    this.currentText = this.messageQueue.shift()!;
    this.displayedChars = 0;
    this.charTimer = 0;
    this.isComplete = false;
    this.indicator.visible = false;
    this.textDisplay.text = '';
  }

  advance(): void {
    if (!this._isVisible) return;

    if (!this.isComplete) {
      this.displayedChars = this.currentText.length;
      this.textDisplay.text = this.currentText;
      this.isComplete = true;
      this.indicator.visible = true;
    } else {
      this.nextMessage();
    }
  }

  hide(): void {
    this._isVisible = false;
    this.container.visible = false;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  update(delta: number): void {
    if (!this._isVisible || this.isComplete) return;

    this.charTimer += delta;
    if (this.charTimer >= this.charSpeed) {
      this.charTimer = 0;
      this.displayedChars++;
      this.textDisplay.text = this.currentText.substring(0, this.displayedChars);

      if (this.displayedChars >= this.currentText.length) {
        this.isComplete = true;
        this.indicator.visible = true;
      }
    }

    // ▼ 点滅（パルス効果）
    if (this.isComplete) {
      const t = Date.now() / 400;
      this.indicator.alpha = 0.5 + Math.sin(t * Math.PI) * 0.5;
    }
  }
}

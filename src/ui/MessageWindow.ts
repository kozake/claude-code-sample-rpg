import { Container, Graphics, Text } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';

const WINDOW_HEIGHT = 96;
const PADDING = 12;
const LINE_HEIGHT = 20;
const MAX_LINES = 3;

/**
 * DQ風メッセージウィンドウ
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
  private charSpeed = 2; // フレームあたりの文字表示間隔
  private isComplete = false;
  private _isVisible = false;
  private onFinish?: () => void;

  constructor() {
    // ウィンドウ背景
    const bg = new Graphics();
    const y = GAME_HEIGHT - WINDOW_HEIGHT - 8;
    bg.roundRect(8, y, GAME_WIDTH - 16, WINDOW_HEIGHT, 4)
      .fill({ color: COLORS.WINDOW_BG, alpha: 0.92 });
    bg.roundRect(8, y, GAME_WIDTH - 16, WINDOW_HEIGHT, 4)
      .stroke({ color: COLORS.WINDOW_BORDER, width: 2 });

    this.textDisplay = new Text({
      text: '',
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        fill: COLORS.TEXT,
        wordWrap: true,
        wordWrapWidth: GAME_WIDTH - 16 - PADDING * 2,
        lineHeight: LINE_HEIGHT,
      },
    });
    this.textDisplay.x = 8 + PADDING;
    this.textDisplay.y = y + PADDING;

    // ▼ 続きインジケーター
    this.indicator = new Text({
      text: '▼',
      style: {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        fill: COLORS.TEXT,
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

  /** メッセージを表示 */
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

  /** 決定ボタン押下時 */
  advance(): void {
    if (!this._isVisible) return;

    if (!this.isComplete) {
      // 全文表示
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

    // ▼ 点滅
    if (this.isComplete) {
      this.indicator.alpha = Math.sin(Date.now() / 300) > 0 ? 1 : 0.3;
    }
  }
}

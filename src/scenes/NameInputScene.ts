import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { DPad } from '../ui/DPad';
import { ActionButton } from '../ui/ActionButton';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';

// DQ風 50音入力テーブル
const CHAR_TABLE = [
  ['あ', 'い', 'う', 'え', 'お', 'は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['か', 'き', 'く', 'け', 'こ', 'ま', 'み', 'む', 'め', 'も'],
  ['さ', 'し', 'す', 'せ', 'そ', 'や', '　', 'ゆ', '　', 'よ'],
  ['た', 'ち', 'つ', 'て', 'と', 'ら', 'り', 'る', 'れ', 'ろ'],
  ['な', 'に', 'ぬ', 'ね', 'の', 'わ', 'を', 'ん', 'ー', '　'],
  ['が', 'ぎ', 'ぐ', 'げ', 'ご', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ', 'ゃ', '　', 'ゅ', '　', 'ょ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ', 'っ', '　', '　', 'もどる', 'おわり'],
];

const COLS = 10;
const ROWS = CHAR_TABLE.length;
const MAX_NAME_LENGTH = 6;
const CELL_W = 28;
const CELL_H = 24;

/**
 * DQ風名前入力画面
 * - 50音表からひらがな選択
 * - 最大6文字
 * - もどる/おわりボタン
 */
export class NameInputScene extends Scene {
  private cursorX = 0;
  private cursorY = 0;
  private name = '';
  private nameText!: Text;
  private cursorGraphic!: Graphics;
  private onComplete: (name: string) => void;
  private charTexts: Text[][] = [];

  constructor(game: Game, onComplete: (name: string) => void) {
    super(game);
    this.onComplete = onComplete;
  }

  onEnter(): void {
    // 背景
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(COLORS.BLACK);
    this.container.addChild(bg);

    // タイトル
    const title = new Text({
      text: 'なまえを いれてください',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fill: COLORS.TEXT }),
    });
    title.x = GAME_WIDTH / 2;
    title.y = 20;
    title.anchor.set(0.5, 0);
    this.container.addChild(title);

    // 名前表示エリア
    const nameWin = new Window(GAME_WIDTH / 2 - 80, 44, 160, 32);
    this.container.addChild(nameWin);

    this.nameText = new Text({
      text: '＿'.repeat(MAX_NAME_LENGTH),
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 16, fill: COLORS.TEXT, letterSpacing: 4 }),
    });
    this.nameText.x = GAME_WIDTH / 2;
    this.nameText.y = 52;
    this.nameText.anchor.set(0.5, 0);
    this.container.addChild(this.nameText);

    // 文字テーブル
    const tableX = (GAME_WIDTH - COLS * CELL_W) / 2;
    const tableY = 90;

    const charStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.TEXT });
    const specialStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: COLORS.HP_GREEN });

    for (let y = 0; y < ROWS; y++) {
      this.charTexts[y] = [];
      for (let x = 0; x < COLS; x++) {
        const ch = CHAR_TABLE[y][x];
        if (ch === '　') {
          this.charTexts[y][x] = null as unknown as Text;
          continue;
        }

        const isSpecial = ch === 'もどる' || ch === 'おわり';
        const text = new Text({
          text: ch,
          style: isSpecial ? specialStyle : charStyle,
        });
        text.x = tableX + x * CELL_W + CELL_W / 2;
        text.y = tableY + y * CELL_H + CELL_H / 2;
        text.anchor.set(0.5);
        this.container.addChild(text);
        this.charTexts[y][x] = text;
      }
    }

    // カーソル
    this.cursorGraphic = new Graphics();
    this.updateCursor();
    this.container.addChild(this.cursorGraphic);

    // タッチUI（DPad + A/Bボタン）
    const dpad = new DPad(this.game.input);
    const actionBtn = new ActionButton(this.game.input);
    this.container.addChild(dpad.container);
    this.container.addChild(actionBtn.container);

    this.updateNameDisplay();
  }

  private updateCursor(): void {
    this.cursorGraphic.clear();
    const tableX = (GAME_WIDTH - COLS * CELL_W) / 2;
    const tableY = 90;
    const ch = CHAR_TABLE[this.cursorY][this.cursorX];
    const isWide = ch === 'もどる' || ch === 'おわり';
    const w = isWide ? CELL_W * 2 : CELL_W;
    const x = tableX + this.cursorX * CELL_W;
    const y = tableY + this.cursorY * CELL_H;

    this.cursorGraphic.roundRect(x + 1, y + 1, w - 2, CELL_H - 2, 2)
      .fill({ color: COLORS.CURSOR, alpha: 0.3 });
    this.cursorGraphic.roundRect(x + 1, y + 1, w - 2, CELL_H - 2, 2)
      .stroke({ color: COLORS.CURSOR, width: 2, alpha: 0.8 });
  }

  private updateNameDisplay(): void {
    let display = '';
    for (let i = 0; i < MAX_NAME_LENGTH; i++) {
      display += i < this.name.length ? this.name[i] : '＿';
    }
    this.nameText.text = display;
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    const dir = input.directionJustPressed;
    if (dir) {
      if (dir === 'up') {
        this.cursorY = (this.cursorY - 1 + ROWS) % ROWS;
        this.skipEmpty();
        this.updateCursor();
      } else if (dir === 'down') {
        this.cursorY = (this.cursorY + 1) % ROWS;
        this.skipEmpty();
        this.updateCursor();
      } else if (dir === 'left') {
        this.cursorX = (this.cursorX - 1 + COLS) % COLS;
        this.skipEmpty();
        this.updateCursor();
      } else if (dir === 'right') {
        this.cursorX = (this.cursorX + 1) % COLS;
        this.skipEmpty();
        this.updateCursor();
      }
    }

    if (input.isActionPressed) {
      this.selectChar();
    }

    if (input.isCancelPressed) {
      this.deleteLast();
    }

    input.resetOneShot();
  }

  private skipEmpty(): void {
    // 空セルをスキップ
    const ch = CHAR_TABLE[this.cursorY][this.cursorX];
    if (ch === '　') {
      // 右に1つずらす
      this.cursorX = (this.cursorX + 1) % COLS;
    }
  }

  private selectChar(): void {
    const ch = CHAR_TABLE[this.cursorY][this.cursorX];

    if (ch === 'もどる') {
      this.deleteLast();
      return;
    }

    if (ch === 'おわり') {
      if (this.name.length > 0) {
        this.onComplete(this.name);
      }
      return;
    }

    if (ch === '　') return;

    if (this.name.length < MAX_NAME_LENGTH) {
      this.name += ch;
      this.updateNameDisplay();
    }
  }

  private deleteLast(): void {
    if (this.name.length > 0) {
      this.name = this.name.slice(0, -1);
      this.updateNameDisplay();
    }
  }
}

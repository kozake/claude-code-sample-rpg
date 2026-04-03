import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { Scene } from '../core/Scene';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, COLORS } from '../constants';
import { FieldScene } from './FieldScene';
import { SaveSlotScene } from './SaveSlotScene';
import { SaveManager } from '../systems/SaveManager';
import type { Game } from '../Game';

const MENU_ITEMS = ['はじめから', 'つづきから', 'ぼうけんのしょをけす'] as const;

export class TitleScene extends Scene {
  private cursorIndex = 0;
  private cursorGraphic!: Graphics;
  private menuTexts: Text[] = [];
  private blinkTimer = 0;
  private inputEnabled = true;

  constructor(game: Game) {
    super(game);
  }

  onEnter(): void {
    this.drawBackground();
    this.drawTitle();
    this.drawMenu();
    this.setupInput();
  }

  private drawBackground(): void {
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fill(COLORS.BLACK);
    this.container.addChild(bg);

    // 星空風の装飾（placeholder）
    const stars = new Graphics();
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * (GAME_HEIGHT * 0.5);
      const size = Math.random() < 0.3 ? 2 : 1;
      stars.rect(x, y, size, size);
      stars.fill(COLORS.WHITE);
    }
    this.container.addChild(stars);
  }

  private drawTitle(): void {
    const titleStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 20,
      fill: COLORS.WHITE,
      align: 'center',
      letterSpacing: 2,
    });

    const title = new Text({
      text: 'ドラゴンクエスト風\nRPG',
      style: titleStyle,
    });
    title.anchor.set(0.5);
    title.x = GAME_WIDTH / 2;
    title.y = GAME_HEIGHT * 0.25;
    this.container.addChild(title);

    // サブタイトル
    const subStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 10,
      fill: COLORS.TEXT_DISABLED,
      align: 'center',
    });

    const sub = new Text({
      text: '~ そして伝説へ ~',
      style: subStyle,
    });
    sub.anchor.set(0.5);
    sub.x = GAME_WIDTH / 2;
    sub.y = GAME_HEIGHT * 0.37;
    this.container.addChild(sub);
  }

  private drawMenu(): void {
    const menuContainer = new Container();
    const menuY = GAME_HEIGHT * 0.55;
    const lineHeight = 32;

    // メニューウィンドウ枠
    const windowBg = new Graphics();
    const windowX = GAME_WIDTH * 0.15;
    const windowW = GAME_WIDTH * 0.7;
    const windowH = lineHeight * MENU_ITEMS.length + 24;

    windowBg.roundRect(windowX, menuY - 12, windowW, windowH, 4);
    windowBg.fill(COLORS.WINDOW_BG);
    windowBg.stroke({ width: 2, color: COLORS.WINDOW_BORDER });
    menuContainer.addChild(windowBg);

    const itemStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 14,
      fill: COLORS.TEXT,
    });

    MENU_ITEMS.forEach((label, i) => {
      const text = new Text({
        text: label,
        style: itemStyle,
      });
      text.x = windowX + 32;
      text.y = menuY + i * lineHeight + 4;
      menuContainer.addChild(text);
      this.menuTexts.push(text);
    });

    // カーソル（▶）
    this.cursorGraphic = new Graphics();
    this.updateCursorPosition();
    menuContainer.addChild(this.cursorGraphic);

    this.container.addChild(menuContainer);

    // 操作説明
    const helpStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 9,
      fill: COLORS.TEXT_DISABLED,
      align: 'center',
    });

    const help = new Text({
      text: 'タップで選択 / ↑↓キー + Enter',
      style: helpStyle,
    });
    help.anchor.set(0.5);
    help.x = GAME_WIDTH / 2;
    help.y = GAME_HEIGHT * 0.88;
    this.container.addChild(help);
  }

  private updateCursorPosition(): void {
    const cursor = this.cursorGraphic;
    cursor.clear();

    const menuY = GAME_HEIGHT * 0.55;
    const windowX = GAME_WIDTH * 0.15;
    const x = windowX + 14;
    const y = menuY + this.cursorIndex * 32 + 10;

    // ▶ を描画
    cursor.moveTo(x, y);
    cursor.lineTo(x + 8, y + 5);
    cursor.lineTo(x, y + 10);
    cursor.closePath();
    cursor.fill(COLORS.CURSOR);
  }

  private setupInput(): void {
    // キーボード入力
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.inputEnabled) return;

      switch (e.key) {
        case 'ArrowUp':
          this.moveCursor(-1);
          break;
        case 'ArrowDown':
          this.moveCursor(1);
          break;
        case 'Enter':
        case ' ':
          this.selectItem(this.cursorIndex);
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // タッチ/クリック入力
    this.menuTexts.forEach((text, i) => {
      text.eventMode = 'static';
      text.cursor = 'pointer';
      // ヒットエリアを少し広げる
      const hitArea = new Graphics();
      hitArea.rect(text.x - 32, text.y - 4, GAME_WIDTH * 0.7, 28);
      hitArea.fill({ color: 0x000000, alpha: 0.001 });
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';
      hitArea.on('pointerdown', () => {
        if (!this.inputEnabled) return;
        this.cursorIndex = i;
        this.updateCursorPosition();
        this.selectItem(i);
      });
      this.container.addChild(hitArea);
    });
  }

  private moveCursor(dir: number): void {
    this.cursorIndex = (this.cursorIndex + dir + MENU_ITEMS.length) % MENU_ITEMS.length;
    this.updateCursorPosition();
  }

  private selectItem(index: number): void {
    this.inputEnabled = false;

    switch (index) {
      case 0:
        // はじめから → フィールドへ（後でオープニングカットシーンを挟む）
        this.blinkSelection(index, () => {
          const field = new FieldScene(this.game, 'world');
          this.game.scenes.switchTo(field);
        });
        break;
      case 1:
        // つづきから → セーブスロット選択（ロードモード）
        this.blinkSelection(index, () => {
          const loadScene = new SaveSlotScene(
            this.game,
            'load',
            (slotId) => {
              const saveManager = new SaveManager(this.game);
              const data = saveManager.load(slotId);
              if (data) {
                this.game.storyFlags = data.storyFlags;
                const field = new FieldScene(this.game, data.currentMap, data.playerPosition.x, data.playerPosition.y);
                this.game.scenes.switchTo(field);
              }
            },
            () => {
              this.game.scenes.switchTo(new TitleScene(this.game));
            }
          );
          this.game.scenes.switchTo(loadScene);
        });
        break;
      case 2:
        // ぼうけんのしょをけす → セーブスロット選択（削除モード）
        this.blinkSelection(index, () => {
          const deleteScene = new SaveSlotScene(
            this.game,
            'delete',
            (slotId) => {
              const saveManager = new SaveManager(this.game);
              saveManager.delete(slotId);
              this.game.scenes.switchTo(new TitleScene(this.game));
            },
            () => {
              this.game.scenes.switchTo(new TitleScene(this.game));
            }
          );
          this.game.scenes.switchTo(deleteScene);
        });
        break;
    }
  }

  private blinkSelection(index: number, onComplete: () => void): void {
    const text = this.menuTexts[index];
    let count = 0;
    const maxBlinks = 6;
    const interval = setInterval(() => {
      text.visible = !text.visible;
      count++;
      if (count >= maxBlinks) {
        clearInterval(interval);
        text.visible = true;
        onComplete();
      }
    }, 80);
  }

  override update(delta: number): void {
    // カーソル点滅アニメーション
    this.blinkTimer += delta;
    if (this.blinkTimer > 30) {
      this.cursorGraphic.visible = !this.cursorGraphic.visible;
      this.blinkTimer = 0;
    }
  }

  override onExit(): void {
    super.onExit();
  }
}

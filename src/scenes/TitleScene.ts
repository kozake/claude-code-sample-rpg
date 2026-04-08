import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { Scene } from '../core/Scene';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY, COLORS } from '../constants';
import { FieldScene } from './FieldScene';
import { CutsceneScene } from './CutsceneScene';
import { SaveSlotScene } from './SaveSlotScene';
import { SaveManager } from '../systems/SaveManager';
import type { Game } from '../Game';
import type { CutsceneData } from '../data/types';

const MENU_ITEMS = ['はじめから', 'つづきから', 'ぼうけんのしょをけす'] as const;

/** タイトル画面の星 */
interface TitleStar {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinklePhase: number;
  twinkleSpeed: number;
  driftX: number;
  driftY: number;
}

export class TitleScene extends Scene {
  private cursorIndex = 0;
  private cursorGraphic!: Graphics;
  private menuTexts: Text[] = [];
  private blinkTimer = 0;
  private inputEnabled = true;

  // アニメーション用
  private stars: TitleStar[] = [];
  private starsGraphics = new Graphics();
  private titleText!: Text;
  private titleShadow!: Text;
  private subText!: Text;
  private titleTimer = 0;

  constructor(game: Game) {
    super(game);
  }

  onEnter(): void {
    this.drawBackground();
    this.drawTitle();
    this.drawMenu();
    this.setupInput();

    // タイトルBGM再生
    this.game.audio.playBgm('title');
  }

  private drawBackground(): void {
    // グラデーション背景（上:暗い紺 → 下:暗い紫）
    const bg = new Graphics();
    const gradientSteps = 20;
    const stepH = Math.ceil(GAME_HEIGHT / gradientSteps);
    for (let i = 0; i < gradientSteps; i++) {
      const t = i / (gradientSteps - 1);
      const r = Math.floor(0x02 + (0x10 - 0x02) * t);
      const g = Math.floor(0x02 + (0x05 - 0x02) * t);
      const b = Math.floor(0x18 + (0x28 - 0x18) * t);
      const color = (r << 16) | (g << 8) | b;
      bg.rect(0, i * stepH, GAME_WIDTH, stepH + 1).fill(color);
    }
    this.container.addChild(bg);

    // 星空アニメーション用の星を生成
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT * 0.7,
        size: Math.random() < 0.15 ? 2.5 : Math.random() < 0.4 ? 1.5 : 1,
        brightness: 0.2 + Math.random() * 0.8,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.01 + Math.random() * 0.03,
        driftX: (Math.random() - 0.5) * 0.05,
        driftY: Math.random() * 0.02 + 0.01,
      });
    }
    this.container.addChild(this.starsGraphics);
  }

  private drawTitle(): void {
    // タイトル影（グロウ効果）
    this.titleShadow = new Text({
      text: 'ドラゴンクエスト風\nRPG',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        fill: 0x4466aa,
        align: 'center',
        letterSpacing: 2,
      }),
    });
    this.titleShadow.anchor.set(0.5);
    this.titleShadow.x = GAME_WIDTH / 2;
    this.titleShadow.y = GAME_HEIGHT * 0.25 + 2;
    this.titleShadow.alpha = 0.6;
    this.container.addChild(this.titleShadow);

    // タイトル本体（金色）
    this.titleText = new Text({
      text: 'ドラゴンクエスト風\nRPG',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        fill: 0xffdd44,
        align: 'center',
        letterSpacing: 2,
        stroke: { color: 0x884400, width: 1 },
      }),
    });
    this.titleText.anchor.set(0.5);
    this.titleText.x = GAME_WIDTH / 2;
    this.titleText.y = GAME_HEIGHT * 0.25;
    this.container.addChild(this.titleText);

    // サブタイトル（フェードイン風の色）
    this.subText = new Text({
      text: '~ そして伝説へ ~',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        fill: 0xaabbdd,
        align: 'center',
      }),
    });
    this.subText.anchor.set(0.5);
    this.subText.x = GAME_WIDTH / 2;
    this.subText.y = GAME_HEIGHT * 0.37;
    this.container.addChild(this.subText);
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
    // 最初のタップ/キー操作でオーディオアンロック
    const unlockAudio = () => {
      this.game.audio.unlock();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

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
    this.game.audio.playSynth('cursor');
    this.updateCursorPosition();
  }

  private selectItem(index: number): void {
    this.inputEnabled = false;
    this.game.audio.playSynth('confirm');

    switch (index) {
      case 0:
        // はじめから → パーティ初期化 → オープニングカットシーン → フィールドへ
        this.blinkSelection(index, async () => {
          const members = this.game.content.getPartyMembers();
          this.game.state.initNewGame(members);
          this.game.storyFlags = {};

          // オープニングカットシーン読み込み
          const cutsceneData = await this.game.content.loadJson<CutsceneData>('story/cutscenes/opening.json');
          if (cutsceneData) {
            const cutscene = new CutsceneScene(this.game, cutsceneData, () => {
              // オープニング後は村の中から開始（DQ風）
              const field = new FieldScene(this.game, 'village', 8, 8);
              this.game.scenes.switchTo(field);
            });
            this.game.scenes.switchTo(cutscene);
          } else {
            // カットシーンデータがなければ直接村へ
            const field = new FieldScene(this.game, 'village', 8, 8);
            this.game.scenes.switchTo(field);
          }
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
                this.game.state.loadFromSave(data);
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

    // タイトルアニメーション
    this.titleTimer += delta * 0.016;

    // タイトル文字のゆっくりパルス
    const pulse = 1 + Math.sin(this.titleTimer * 1.5) * 0.03;
    this.titleText.scale.set(pulse);
    this.titleShadow.scale.set(pulse * 1.05);
    this.titleShadow.alpha = 0.4 + Math.sin(this.titleTimer * 2) * 0.2;

    // サブタイトルのフェード
    this.subText.alpha = 0.6 + Math.sin(this.titleTimer * 1.2) * 0.3;

    // 星空アニメーション
    this.starsGraphics.clear();
    for (const star of this.stars) {
      star.twinklePhase += star.twinkleSpeed * delta;
      star.x += star.driftX * delta;
      star.y += star.driftY * delta;

      // 画面外に出たら上に戻す
      if (star.y > GAME_HEIGHT * 0.7) {
        star.y = 0;
        star.x = Math.random() * GAME_WIDTH;
      }
      if (star.x < 0) star.x = GAME_WIDTH;
      if (star.x > GAME_WIDTH) star.x = 0;

      const alpha = star.brightness * (0.3 + 0.7 * Math.abs(Math.sin(star.twinklePhase)));

      // 大きい星はグロウ付き
      if (star.size >= 2) {
        this.starsGraphics.circle(star.x, star.y, star.size + 2).fill({ color: 0x6688cc, alpha: alpha * 0.2 });
        this.starsGraphics.circle(star.x, star.y, star.size + 1).fill({ color: 0x88aadd, alpha: alpha * 0.3 });
      }
      this.starsGraphics.circle(star.x, star.y, star.size).fill({ color: 0xeeeeff, alpha });
    }
  }

  override onExit(): void {
    super.onExit();
  }
}

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
  color: number;
}

/** 流れ星 */
interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export class TitleScene extends Scene {
  private cursorIndex = 0;
  private cursorGraphic!: Graphics;
  private menuTexts: Text[] = [];
  private blinkTimer = 0;
  private inputEnabled = true;

  // アニメーション用
  private stars: TitleStar[] = [];
  private shootingStars: ShootingStar[] = [];
  private starsGraphics = new Graphics();
  private titleText!: Text;
  private titleShadow!: Text;
  private titleGlow!: Graphics;
  private subText!: Text;
  private titleTimer = 0;
  private shootingStarTimer = 0;

  constructor(game: Game) {
    super(game);
  }

  onEnter(): void {
    this.drawBackground();
    this.drawTitle();
    this.drawMenu();
    this.setupInput();

    this.game.audio.playBgm('title');
  }

  private drawBackground(): void {
    // リッチグラデーション背景（宇宙感のある深い紺 → 暗い紫 → 深い藍）
    const bg = new Graphics();
    const gradientSteps = 30;
    const stepH = Math.ceil(GAME_HEIGHT / gradientSteps);
    for (let i = 0; i < gradientSteps; i++) {
      const t = i / (gradientSteps - 1);
      // 非線形グラデーション（中間に紫のアクセント）
      const r = Math.floor(0x02 + (0x14 - 0x02) * t * t);
      const g = Math.floor(0x01 + (0x04 - 0x01) * t);
      const b = Math.floor(0x10 + (0x30 - 0x10) * Math.sin(t * Math.PI * 0.7));
      const color = (r << 16) | (g << 8) | b;
      bg.rect(0, i * stepH, GAME_WIDTH, stepH + 1).fill(color);
    }

    // 下部に微かな山のシルエット
    bg.moveTo(0, GAME_HEIGHT * 0.85);
    bg.lineTo(GAME_WIDTH * 0.15, GAME_HEIGHT * 0.78);
    bg.lineTo(GAME_WIDTH * 0.3, GAME_HEIGHT * 0.82);
    bg.lineTo(GAME_WIDTH * 0.45, GAME_HEIGHT * 0.75);
    bg.lineTo(GAME_WIDTH * 0.6, GAME_HEIGHT * 0.80);
    bg.lineTo(GAME_WIDTH * 0.75, GAME_HEIGHT * 0.76);
    bg.lineTo(GAME_WIDTH * 0.9, GAME_HEIGHT * 0.82);
    bg.lineTo(GAME_WIDTH, GAME_HEIGHT * 0.79);
    bg.lineTo(GAME_WIDTH, GAME_HEIGHT);
    bg.lineTo(0, GAME_HEIGHT);
    bg.closePath();
    bg.fill({ color: 0x060818, alpha: 0.8 });

    this.container.addChild(bg);

    // 星空（数を増やして色のバリエーション追加）
    this.stars = [];
    const starColors = [0xeeeeff, 0xccddff, 0xffeedd, 0xddddff, 0xffffff];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT * 0.78,
        size: Math.random() < 0.08 ? 3 : Math.random() < 0.2 ? 2 : Math.random() < 0.5 ? 1.2 : 0.7,
        brightness: 0.15 + Math.random() * 0.85,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.008 + Math.random() * 0.025,
        driftX: (Math.random() - 0.5) * 0.03,
        driftY: Math.random() * 0.015 + 0.005,
        color: starColors[Math.floor(Math.random() * starColors.length)],
      });
    }
    this.container.addChild(this.starsGraphics);
  }

  private drawTitle(): void {
    // タイトルグロウ（背景光）
    this.titleGlow = new Graphics();
    this.container.addChild(this.titleGlow);

    // タイトル影（深いグロウ効果）
    this.titleShadow = new Text({
      text: 'ドラゴンクエスト風\nRPG',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 22,
        fill: 0x3355aa,
        align: 'center',
        letterSpacing: 3,
      }),
    });
    this.titleShadow.anchor.set(0.5);
    this.titleShadow.x = GAME_WIDTH / 2;
    this.titleShadow.y = GAME_HEIGHT * 0.24 + 2;
    this.titleShadow.alpha = 0.5;
    this.container.addChild(this.titleShadow);

    // タイトル本体（金色 + 強いストローク）
    this.titleText = new Text({
      text: 'ドラゴンクエスト風\nRPG',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 22,
        fill: 0xffd844,
        align: 'center',
        letterSpacing: 3,
        stroke: { color: 0x663300, width: 2 },
      }),
    });
    this.titleText.anchor.set(0.5);
    this.titleText.x = GAME_WIDTH / 2;
    this.titleText.y = GAME_HEIGHT * 0.24;
    this.container.addChild(this.titleText);

    // サブタイトル
    this.subText = new Text({
      text: '~ そして伝説へ ~',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        fill: 0x90a8d0,
        align: 'center',
        letterSpacing: 1,
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

    // メニューウィンドウ枠（リッチ版）
    const windowBg = new Graphics();
    const windowX = GAME_WIDTH * 0.13;
    const windowW = GAME_WIDTH * 0.74;
    const windowH = lineHeight * MENU_ITEMS.length + 24;
    const r = 6;

    // ドロップシャドウ
    windowBg.roundRect(windowX + 2, menuY - 10, windowW, windowH, r)
      .fill({ color: 0x000008, alpha: 0.6 });
    // 外枠
    windowBg.roundRect(windowX - 1, menuY - 13, windowW + 2, windowH + 2, r + 1)
      .fill({ color: COLORS.WINDOW_BORDER_OUTER, alpha: 0.8 });
    // 背景
    windowBg.roundRect(windowX + 1, menuY - 11, windowW - 2, windowH - 2, r - 1)
      .fill({ color: COLORS.WINDOW_BG_DARK, alpha: 0.95 });
    // ハイライト
    windowBg.roundRect(windowX + 2, menuY - 10, windowW - 4, 12, r - 2)
      .fill({ color: COLORS.WINDOW_HIGHLIGHT, alpha: 0.4 });
    // 内枠
    windowBg.roundRect(windowX + 3, menuY - 9, windowW - 6, windowH - 6, r - 1)
      .stroke({ color: 0x5060b0, width: 1, alpha: 0.5 });
    // 外枠ボーダー
    windowBg.roundRect(windowX, menuY - 12, windowW, windowH, r)
      .stroke({ color: COLORS.WINDOW_BORDER, width: 2 });

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
      text.x = windowX + 36;
      text.y = menuY + i * lineHeight + 4;
      menuContainer.addChild(text);
      this.menuTexts.push(text);
    });

    // カーソル（金色の▶ + グロウ）
    this.cursorGraphic = new Graphics();
    this.updateCursorPosition();
    menuContainer.addChild(this.cursorGraphic);

    this.container.addChild(menuContainer);

    // 操作説明
    const help = new Text({
      text: 'タップで選択 / ↑↓キー + Enter',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        fill: 0x607090,
        align: 'center',
      }),
    });
    help.anchor.set(0.5);
    help.x = GAME_WIDTH / 2;
    help.y = GAME_HEIGHT * 0.9;
    this.container.addChild(help);
  }

  private updateCursorPosition(): void {
    const cursor = this.cursorGraphic;
    cursor.clear();

    const menuY = GAME_HEIGHT * 0.55;
    const windowX = GAME_WIDTH * 0.13;
    const x = windowX + 16;
    const y = menuY + this.cursorIndex * 32 + 10;

    // カーソルグロウ
    cursor.moveTo(x - 2, y - 2);
    cursor.lineTo(x + 10, y + 5);
    cursor.lineTo(x - 2, y + 12);
    cursor.closePath();
    cursor.fill({ color: COLORS.CURSOR_GLOW, alpha: 0.3 });

    // カーソル本体（金色の▶）
    cursor.moveTo(x, y);
    cursor.lineTo(x + 8, y + 5);
    cursor.lineTo(x, y + 10);
    cursor.closePath();
    cursor.fill(COLORS.CURSOR);
  }

  private setupInput(): void {
    const unlockAudio = () => {
      this.game.audio.unlock();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

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

    this.menuTexts.forEach((text, i) => {
      text.eventMode = 'static';
      text.cursor = 'pointer';
      const hitArea = new Graphics();
      hitArea.rect(text.x - 36, text.y - 4, GAME_WIDTH * 0.74, 28);
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
    this.game.audio.playSeOrSynth('cursor');
    this.updateCursorPosition();
  }

  private selectItem(index: number): void {
    this.inputEnabled = false;
    this.game.audio.playSeOrSynth('confirm');

    switch (index) {
      case 0:
        this.blinkSelection(index, async () => {
          const members = this.game.content.getPartyMembers();
          this.game.state.initNewGame(members);
          this.game.storyFlags = {};

          const cutsceneData = await this.game.content.loadJson<CutsceneData>('story/cutscenes/opening.json');
          if (cutsceneData) {
            const cutscene = new CutsceneScene(this.game, cutsceneData, () => {
              const field = new FieldScene(this.game, 'village', 8, 8);
              this.game.scenes.switchTo(field);
            });
            this.game.scenes.switchTo(cutscene);
          } else {
            const field = new FieldScene(this.game, 'village', 8, 8);
            this.game.scenes.switchTo(field);
          }
        });
        break;
      case 1:
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
    // カーソル点滅
    this.blinkTimer += delta;
    if (this.blinkTimer > 30) {
      this.cursorGraphic.visible = !this.cursorGraphic.visible;
      this.blinkTimer = 0;
    }

    this.titleTimer += delta * 0.016;

    // タイトル文字のパルス
    const pulse = 1 + Math.sin(this.titleTimer * 1.5) * 0.025;
    this.titleText.scale.set(pulse);
    this.titleShadow.scale.set(pulse * 1.06);
    this.titleShadow.alpha = 0.35 + Math.sin(this.titleTimer * 2) * 0.2;

    // タイトルグロウ（背景光の脈動）
    this.titleGlow.clear();
    const glowAlpha = 0.04 + Math.sin(this.titleTimer * 1.2) * 0.03;
    this.titleGlow.circle(GAME_WIDTH / 2, GAME_HEIGHT * 0.24, 80)
      .fill({ color: 0xffd844, alpha: glowAlpha });
    this.titleGlow.circle(GAME_WIDTH / 2, GAME_HEIGHT * 0.24, 50)
      .fill({ color: 0xffd844, alpha: glowAlpha * 1.5 });

    // サブタイトルのフェード
    this.subText.alpha = 0.5 + Math.sin(this.titleTimer * 1.0) * 0.3;

    // 流れ星の生成
    this.shootingStarTimer += delta;
    if (this.shootingStarTimer > 180 + Math.random() * 240) {
      this.shootingStarTimer = 0;
      this.shootingStars.push({
        x: Math.random() * GAME_WIDTH * 0.8,
        y: Math.random() * GAME_HEIGHT * 0.3,
        vx: 3 + Math.random() * 2,
        vy: 1.5 + Math.random(),
        life: 1,
        maxLife: 20 + Math.random() * 15,
        size: 1.5 + Math.random(),
      });
    }

    // 星空アニメーション
    this.starsGraphics.clear();

    // 流れ星の描画
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const ss = this.shootingStars[i];
      ss.x += ss.vx * delta;
      ss.y += ss.vy * delta;
      ss.life -= delta / ss.maxLife;

      if (ss.life <= 0) {
        this.shootingStars.splice(i, 1);
        continue;
      }

      const alpha = ss.life;
      // 尾
      const tailLen = 8;
      for (let t = 0; t < tailLen; t++) {
        const tailAlpha = alpha * (1 - t / tailLen) * 0.6;
        const tx = ss.x - ss.vx * t * 0.5;
        const ty = ss.y - ss.vy * t * 0.5;
        this.starsGraphics.circle(tx, ty, ss.size * (1 - t / tailLen * 0.5))
          .fill({ color: 0xddeeff, alpha: tailAlpha });
      }
      // 頭
      this.starsGraphics.circle(ss.x, ss.y, ss.size + 1)
        .fill({ color: 0xffffff, alpha });
    }

    // 通常の星
    for (const star of this.stars) {
      star.twinklePhase += star.twinkleSpeed * delta;
      star.x += star.driftX * delta;
      star.y += star.driftY * delta;

      if (star.y > GAME_HEIGHT * 0.78) {
        star.y = 0;
        star.x = Math.random() * GAME_WIDTH;
      }
      if (star.x < 0) star.x = GAME_WIDTH;
      if (star.x > GAME_WIDTH) star.x = 0;

      const alpha = star.brightness * (0.2 + 0.8 * Math.abs(Math.sin(star.twinklePhase)));

      // 大きい星のグロウ
      if (star.size >= 2.5) {
        this.starsGraphics.circle(star.x, star.y, star.size + 3).fill({ color: star.color, alpha: alpha * 0.08 });
        this.starsGraphics.circle(star.x, star.y, star.size + 1.5).fill({ color: star.color, alpha: alpha * 0.2 });
      } else if (star.size >= 1.5) {
        this.starsGraphics.circle(star.x, star.y, star.size + 1).fill({ color: star.color, alpha: alpha * 0.15 });
      }
      this.starsGraphics.circle(star.x, star.y, star.size).fill({ color: star.color, alpha });

      // 明るい星の中心に白い点
      if (star.size >= 2) {
        this.starsGraphics.circle(star.x, star.y, star.size * 0.35).fill({ color: 0xffffff, alpha });
      }
    }
  }

  override onExit(): void {
    super.onExit();
  }
}

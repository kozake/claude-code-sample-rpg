import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { Scene } from '../core/Scene';
import { MessageWindow } from '../ui/MessageWindow';
import { ActionButton } from '../ui/ActionButton';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import { NameInputScene } from './NameInputScene';
import type { Game } from '../Game';
import type { CutsceneData, CutsceneStep } from '../data/types';

/**
 * カットシーンエンジン
 * - JSON定義のステップを順次実行
 * - message / fadeIn / fadeOut / wait / setFlag / warp / nameInput 等
 */
export class CutsceneScene extends Scene {
  private steps: CutsceneStep[];
  private currentIdx = 0;
  private messageWindow = new MessageWindow();
  private fadeOverlay: Graphics;
  private waiting = false;
  private waitTimer = 0;
  private onComplete: () => void;

  constructor(game: Game, cutscene: CutsceneData, onComplete: () => void) {
    super(game);
    this.steps = cutscene.steps;
    this.onComplete = onComplete;

    // フェード用オーバーレイ
    this.fadeOverlay = new Graphics();
    this.fadeOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(COLORS.BLACK);
    this.fadeOverlay.alpha = 1;
  }

  onEnter(): void {
    // 背景（黒）- タップで決定入力（スマホ対応）
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(COLORS.BLACK);
    bg.eventMode = 'static';
    bg.on('pointerdown', () => this.game.input.setTouchAction());
    this.container.addChild(bg);

    this.container.addChild(this.fadeOverlay);
    this.container.addChild(this.messageWindow.container);

    // タッチUI（Aボタン表示）
    const actionBtn = new ActionButton(this.game.input);
    this.container.addChild(actionBtn.container);

    this.executeCurrentStep();
  }

  private executeCurrentStep(): void {
    if (this.currentIdx >= this.steps.length) {
      this.onComplete();
      return;
    }

    const step = this.steps[this.currentIdx];

    switch (step.type) {
      case 'message':
        this.executeMessage(step);
        break;
      case 'fadeIn':
        this.executeFade(false, step.duration ?? 60);
        break;
      case 'fadeOut':
        this.executeFade(true, step.duration ?? 60);
        break;
      case 'wait':
        this.executeWait(step.duration ?? 60);
        break;
      case 'setFlag':
        if (step.flagKey) {
          this.game.storyFlags[step.flagKey] = step.flagValue ?? true;
        }
        this.nextStep();
        break;
      case 'showSprite':
        this.executeShowSprite(step);
        break;
      case 'hideSprite':
        this.executeHideSprite(step);
        break;
      case 'nameInput':
        this.executeNameInput();
        break;
      case 'addPartyMember':
        if (step.memberId) {
          // GameStateにメンバー追加（後続Phaseでメンバーマスタ参照）
        }
        this.nextStep();
        break;
      default:
        this.nextStep();
        break;
    }
  }

  private executeMessage(step: CutsceneStep): void {
    const lines = step.text ?? [];
    if (lines.length === 0) {
      this.nextStep();
      return;
    }
    this.messageWindow.show(lines, () => this.nextStep());
  }

  private executeFade(toBlack: boolean, duration: number): void {
    this.fadeOverlay.alpha = toBlack ? 0 : 1;
    const target = toBlack ? 1 : 0;
    const step = (target - this.fadeOverlay.alpha) / duration;

    const fade = () => {
      this.fadeOverlay.alpha += step;
      if ((step > 0 && this.fadeOverlay.alpha >= target) ||
          (step < 0 && this.fadeOverlay.alpha <= target)) {
        this.fadeOverlay.alpha = target;
        this.nextStep();
        return;
      }
      requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }

  private executeWait(duration: number): void {
    this.waiting = true;
    this.waitTimer = duration;
  }

  private executeShowSprite(step: CutsceneStep): void {
    // 仮実装: テキストラベルで代替
    if (step.asset) {
      const label = new Text({
        text: step.asset,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 16, fill: COLORS.TEXT }),
      });
      label.name = `sprite_${step.asset}`;
      label.anchor.set(0.5);
      label.x = step.position?.x ?? GAME_WIDTH / 2;
      label.y = step.position?.y ?? GAME_HEIGHT / 2;
      this.container.addChild(label);
    }
    this.nextStep();
  }

  private executeHideSprite(step: CutsceneStep): void {
    if (step.asset) {
      const child = this.container.getChildByName(`sprite_${step.asset}`);
      if (child) this.container.removeChild(child);
    }
    this.nextStep();
  }

  private executeNameInput(): void {
    const nameScene = new NameInputScene(this.game, (name: string) => {
      // 主人公の名前を設定
      if (this.game.state.active.length > 0) {
        this.game.state.active[0].name = name;
      }
      // カットシーンに戻る
      this.game.scenes.switchTo(this);
      this.nextStep();
    });
    this.game.scenes.switchTo(nameScene);
  }

  private nextStep(): void {
    this.currentIdx++;
    this.executeCurrentStep();
  }

  update(delta: number): void {
    const input = this.game.input;
    input.update();

    if (this.messageWindow.isVisible) {
      this.messageWindow.update(delta);
      if (input.isActionPressed) {
        this.messageWindow.advance();
      }
    }

    if (this.waiting) {
      this.waitTimer -= delta;
      if (this.waitTimer <= 0) {
        this.waiting = false;
        this.nextStep();
      }
    }

    input.resetOneShot();
  }
}

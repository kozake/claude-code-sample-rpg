import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../constants';

/**
 * 戦闘ビジュアルエフェクト
 * - 画面フラッシュ / シェイク / ダメージ数値ポップアップ
 * - 斬撃エフェクト / 回復エフェクト / 敵撃破エフェクト
 */
export class BattleEffects {
  private effectLayer: Container;
  private flashOverlay: Graphics;

  constructor(effectLayer: Container) {
    this.effectLayer = effectLayer;

    this.flashOverlay = new Graphics();
    this.flashOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0xffffff);
    this.flashOverlay.alpha = 0;
    this.flashOverlay.zIndex = 9999;
    this.effectLayer.addChild(this.flashOverlay);
  }

  /** 画面フラッシュ */
  flash(color: number, alpha = 0.6, duration = 200): void {
    this.flashOverlay.clear();
    this.flashOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(color);
    this.flashOverlay.alpha = alpha;

    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      this.flashOverlay.alpha = alpha * (1 - easeOutQuad(progress));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** 画面シェイク */
  shake(target: Container, intensity = 4, duration = 300): void {
    const origX = target.x;
    const origY = target.y;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      if (progress < 1) {
        const decay = 1 - progress;
        target.x = origX + (Math.random() - 0.5) * intensity * 2 * decay;
        target.y = origY + (Math.random() - 0.5) * intensity * 2 * decay;
        requestAnimationFrame(animate);
      } else {
        target.x = origX;
        target.y = origY;
      }
    };
    requestAnimationFrame(animate);
  }

  /** ダメージ数値ポップアップ */
  showDamage(x: number, y: number, damage: number, isCritical: boolean): void {
    const fontSize = isCritical ? 20 : 14;
    const color = isCritical ? 0xffff00 : 0xffffff;

    const text = new Text({
      text: `${damage}`,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize,
        fill: color,
        stroke: { color: 0x000000, width: 3 },
      }),
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    this.effectLayer.addChild(text);

    const startTime = performance.now();
    const startY = y;
    const duration = 800;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      // 上に浮かぶ + バウンス
      const bounce = Math.sin(progress * Math.PI) * 20;
      text.y = startY - progress * 25 - bounce;
      text.alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;

      // クリティカルは拡縮アニメーション
      if (isCritical && progress < 0.2) {
        const scale = 1 + Math.sin(progress / 0.2 * Math.PI) * 0.5;
        text.scale.set(scale);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.effectLayer.removeChild(text);
      }
    };
    requestAnimationFrame(animate);
  }

  /** 回復数値ポップアップ */
  showHeal(x: number, y: number, amount: number): void {
    const text = new Text({
      text: `${amount}`,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        fill: 0x00ff88,
        stroke: { color: 0x003311, width: 3 },
      }),
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    this.effectLayer.addChild(text);

    const startTime = performance.now();
    const startY = y;
    const duration = 800;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      text.y = startY - progress * 30;
      text.alpha = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.effectLayer.removeChild(text);
      }
    };
    requestAnimationFrame(animate);
  }

  /** 斬撃エフェクト */
  showSlash(x: number, y: number): void {
    const slash = new Graphics();
    this.effectLayer.addChild(slash);

    const startTime = performance.now();
    const duration = 250;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      slash.clear();

      if (progress < 0.5) {
        // 斬撃ライン描画（複数ライン）
        const p = progress / 0.5;
        const alpha = 1;

        slash.setStrokeStyle({ width: 3, color: 0xffffff, alpha });
        // メインの斜め斬撃
        const startPx = x - 20 + p * 10;
        const startPy = y - 20 + p * 10;
        const endPx = x + 20 * p;
        const endPy = y + 20 * p;
        slash.moveTo(startPx, startPy);
        slash.lineTo(endPx, endPy);
        slash.stroke();

        // サブライン
        slash.setStrokeStyle({ width: 2, color: 0xaaddff, alpha: alpha * 0.7 });
        slash.moveTo(x + 15 - p * 30, y - 10);
        slash.lineTo(x - 15 + p * 30, y + 10);
        slash.stroke();
      } else {
        // フェードアウト
        const fadeP = (progress - 0.5) / 0.5;
        const alpha = 1 - fadeP;

        slash.setStrokeStyle({ width: 3, color: 0xffffff, alpha });
        slash.moveTo(x - 10, y - 10);
        slash.lineTo(x + 20, y + 20);
        slash.stroke();

        slash.setStrokeStyle({ width: 2, color: 0xaaddff, alpha: alpha * 0.7 });
        slash.moveTo(x + 15, y - 10);
        slash.lineTo(x - 15, y + 10);
        slash.stroke();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.effectLayer.removeChild(slash);
      }
    };
    requestAnimationFrame(animate);
  }

  /** 回復スパークルエフェクト */
  showHealSparkle(x: number, y: number): void {
    const sparkles = new Graphics();
    this.effectLayer.addChild(sparkles);

    const particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      particles.push({
        x: x + Math.cos(angle) * 5,
        y: y + Math.sin(angle) * 5,
        vx: Math.cos(angle) * 0.8,
        vy: Math.sin(angle) * 0.8 - 1,
        size: 2 + Math.random() * 2,
      });
    }

    const startTime = performance.now();
    const duration = 600;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      sparkles.clear();
      const alpha = 1 - progress;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        sparkles.circle(p.x, p.y, p.size * (1 - progress * 0.5)).fill({ color: 0x00ff88, alpha });
        sparkles.circle(p.x, p.y, p.size * 0.5 * (1 - progress * 0.5)).fill({ color: 0xffffff, alpha });
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.effectLayer.removeChild(sparkles);
      }
    };
    requestAnimationFrame(animate);
  }

  /** 敵撃破エフェクト（対象Containerをフェードアウト + 赤フラッシュ） */
  enemyDeath(target: Container): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const duration = 400;

      // 赤フラッシュ
      this.flash(0xff0000, 0.3, 200);

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        // 点滅しながらフェードアウト
        const blink = Math.sin(progress * Math.PI * 8) > 0;
        target.alpha = blink ? 1 - progress : 0;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          target.alpha = 0;
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  /** 戦闘開始トランジション（白フラッシュ） */
  battleTransition(): Promise<void> {
    return new Promise((resolve) => {
      this.flashOverlay.clear();
      this.flashOverlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0xffffff);
      this.flashOverlay.alpha = 1;

      const startTime = performance.now();
      const duration = 500;

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        this.flashOverlay.alpha = 1 - easeOutQuad(progress);
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.flashOverlay.alpha = 0;
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  /** 勝利エフェクト */
  victoryFlash(): void {
    // 金色のフラッシュ
    this.flash(0xffdd00, 0.5, 600);
  }
}

/** イージング関数: ease-out quadratic */
function easeOutQuad(t: number): number {
  return t * (2 - t);
}

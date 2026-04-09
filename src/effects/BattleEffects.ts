import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../constants';

/**
 * 戦闘ビジュアルエフェクト（リッチ版）
 * - 画面フラッシュ / シェイク / ダメージ数値ポップアップ
 * - 斬撃エフェクト / 回復エフェクト / 敵撃破エフェクト
 * - パーティクルベースの豪華なエフェクト
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

  /** ダメージ数値ポップアップ（リッチ版） */
  showDamage(x: number, y: number, damage: number, isCritical: boolean): void {
    const fontSize = isCritical ? 22 : 15;
    const color = isCritical ? 0xffee44 : 0xffffff;
    const strokeColor = isCritical ? 0x882200 : 0x220044;

    const text = new Text({
      text: `${damage}`,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize,
        fill: color,
        stroke: { color: strokeColor, width: 4 },
      }),
    });
    text.anchor.set(0.5);
    text.x = x;
    text.y = y;
    this.effectLayer.addChild(text);

    // クリティカル時はスパーク粒子を追加
    let sparkles: Graphics | null = null;
    if (isCritical) {
      sparkles = new Graphics();
      this.effectLayer.addChild(sparkles);
    }

    const startTime = performance.now();
    const startY = y;
    const duration = 900;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      // 上に浮かぶ + バウンス
      const bounce = Math.sin(progress * Math.PI) * 24;
      text.y = startY - progress * 30 - bounce;
      text.alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;

      // クリティカルのスケールパルス
      if (isCritical) {
        if (progress < 0.15) {
          const scale = 1 + Math.sin(progress / 0.15 * Math.PI) * 0.6;
          text.scale.set(scale);
        }
        // スパーク粒子
        if (sparkles) {
          sparkles.clear();
          const sparkAlpha = Math.max(0, 1 - progress * 1.5);
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + progress * 3;
            const dist = 15 + progress * 25;
            const sx = x + Math.cos(angle) * dist;
            const sy = text.y + Math.sin(angle) * dist * 0.6;
            sparkles.circle(sx, sy, 1.5 * (1 - progress)).fill({ color: 0xffee88, alpha: sparkAlpha });
          }
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.effectLayer.removeChild(text);
        if (sparkles) this.effectLayer.removeChild(sparkles);
      }
    };
    requestAnimationFrame(animate);
  }

  /** 回復数値ポップアップ（リッチ版） */
  showHeal(x: number, y: number, amount: number): void {
    const text = new Text({
      text: `${amount}`,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 15,
        fill: 0x40ff90,
        stroke: { color: 0x003318, width: 4 },
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

  /** 斬撃エフェクト（リッチ版 - クロスカット + パーティクル） */
  showSlash(x: number, y: number): void {
    const slash = new Graphics();
    this.effectLayer.addChild(slash);

    const particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
      });
    }

    const startTime = performance.now();
    const duration = 350;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      slash.clear();

      if (progress < 0.5) {
        const p = progress / 0.5;
        // メイン斬撃（太いラインからシャープに）
        const lineWidth = 4 * (1 - p * 0.5);

        // 斬撃ライン1（右下がり）
        slash.setStrokeStyle({ width: lineWidth, color: 0xffffff, alpha: 1 });
        slash.moveTo(x - 25 + p * 12, y - 25 + p * 12);
        slash.lineTo(x + 25 * p, y + 25 * p);
        slash.stroke();

        // グロウライン
        slash.setStrokeStyle({ width: lineWidth + 4, color: 0x88bbff, alpha: 0.4 });
        slash.moveTo(x - 25 + p * 12, y - 25 + p * 12);
        slash.lineTo(x + 25 * p, y + 25 * p);
        slash.stroke();

        // 斬撃ライン2（左下がり）
        slash.setStrokeStyle({ width: lineWidth * 0.7, color: 0xccddff, alpha: 0.8 });
        slash.moveTo(x + 20 - p * 40, y - 15);
        slash.lineTo(x - 20 + p * 40, y + 15);
        slash.stroke();

      } else {
        // フェードアウト + パーティクル
        const fadeP = (progress - 0.5) / 0.5;
        const alpha = 1 - fadeP;

        slash.setStrokeStyle({ width: 2, color: 0xffffff, alpha });
        slash.moveTo(x - 13, y - 13);
        slash.lineTo(x + 25, y + 25);
        slash.stroke();

        slash.setStrokeStyle({ width: 1.5, color: 0xccddff, alpha: alpha * 0.7 });
        slash.moveTo(x + 20, y - 15);
        slash.lineTo(x - 20, y + 15);
        slash.stroke();
      }

      // パーティクル描画
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life > 0) {
          slash.circle(p.x, p.y, 1.5 * p.life).fill({ color: 0xddeeff, alpha: p.life });
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.effectLayer.removeChild(slash);
      }
    };
    requestAnimationFrame(animate);
  }

  /** 回復スパークルエフェクト（リッチ版 - 螺旋上昇） */
  showHealSparkle(x: number, y: number): void {
    const sparkles = new Graphics();
    this.effectLayer.addChild(sparkles);

    const particles: { angle: number; dist: number; y: number; speed: number; size: number; color: number }[] = [];
    for (let i = 0; i < 12; i++) {
      particles.push({
        angle: (i / 12) * Math.PI * 2,
        dist: 5 + Math.random() * 10,
        y: y + 10,
        speed: 0.8 + Math.random() * 0.5,
        size: 2 + Math.random() * 2,
        color: Math.random() > 0.5 ? 0x40ff90 : 0x80ffb0,
      });
    }

    const startTime = performance.now();
    const duration = 700;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      sparkles.clear();
      const alpha = 1 - progress * 0.8;

      for (const p of particles) {
        p.angle += 0.06;
        p.y -= p.speed;
        p.dist += 0.3;

        const px = x + Math.cos(p.angle) * p.dist;
        const py = p.y;
        const size = p.size * (1 - progress * 0.5);

        // グロウ
        sparkles.circle(px, py, size + 2).fill({ color: p.color, alpha: alpha * 0.2 });
        // コア
        sparkles.circle(px, py, size).fill({ color: p.color, alpha });
        // 中心の白
        sparkles.circle(px, py, size * 0.4).fill({ color: 0xffffff, alpha });
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.effectLayer.removeChild(sparkles);
      }
    };
    requestAnimationFrame(animate);
  }

  /** 敵撃破エフェクト（リッチ版 - 分解 + 赤フラッシュ） */
  enemyDeath(target: Container): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const duration = 500;

      this.flash(0xff0000, 0.3, 250);

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        // 点滅 + フェードアウト + 縮小
        const blink = Math.sin(progress * Math.PI * 10) > 0;
        target.alpha = blink ? (1 - progress * 0.8) : 0;
        target.scale.set(1 - progress * 0.3);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          target.alpha = 0;
          target.scale.set(1);
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  /** 戦闘開始トランジション（リッチ版 - ストライプ + フラッシュ） */
  battleTransition(): Promise<void> {
    return new Promise((resolve) => {
      const overlay = new Graphics();
      this.effectLayer.addChild(overlay);

      const startTime = performance.now();
      const duration = 600;

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);

        overlay.clear();

        if (progress < 0.4) {
          // ストライプ効果
          const p = progress / 0.4;
          const stripeCount = 8;
          const stripeH = GAME_HEIGHT / stripeCount;
          for (let i = 0; i < stripeCount; i++) {
            const stripeW = GAME_WIDTH * p * (i % 2 === 0 ? 1 : 0.8);
            const x = i % 2 === 0 ? 0 : GAME_WIDTH - stripeW;
            overlay.rect(x, i * stripeH, stripeW, stripeH)
              .fill({ color: 0xffffff, alpha: 0.8 * p });
          }
        } else if (progress < 0.6) {
          // 全面フラッシュ
          overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT)
            .fill({ color: 0xffffff, alpha: 1 });
        } else {
          // フェードアウト
          const fadeP = (progress - 0.6) / 0.4;
          overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT)
            .fill({ color: 0xffffff, alpha: 1 - easeOutQuad(fadeP) });
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.effectLayer.removeChild(overlay);
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  /** 勝利エフェクト（リッチ版 - 金色パーティクル噴出） */
  victoryFlash(): void {
    this.flash(0xffdd00, 0.5, 600);

    // 金色パーティクル
    const particles = new Graphics();
    this.effectLayer.addChild(particles);

    const pts: { x: number; y: number; vx: number; vy: number; size: number; color: number }[] = [];
    for (let i = 0; i < 20; i++) {
      pts.push({
        x: GAME_WIDTH / 2,
        y: GAME_HEIGHT * 0.4,
        vx: (Math.random() - 0.5) * 6,
        vy: -2 - Math.random() * 4,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.5 ? 0xffdd44 : 0xffe888,
      });
    }

    const startTime = performance.now();
    const duration = 1000;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      particles.clear();
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // 重力
        const alpha = 1 - progress;
        const size = p.size * (1 - progress * 0.5);
        particles.circle(p.x, p.y, size + 1).fill({ color: p.color, alpha: alpha * 0.3 });
        particles.circle(p.x, p.y, size).fill({ color: p.color, alpha });
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.effectLayer.removeChild(particles);
      }
    };
    requestAnimationFrame(animate);
  }
}

/** イージング関数: ease-out quadratic */
function easeOutQuad(t: number): number {
  return t * (2 - t);
}

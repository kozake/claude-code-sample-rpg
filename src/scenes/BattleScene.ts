import { Graphics, Text, TextStyle, Container, Sprite, Texture, Assets } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { DPad } from '../ui/DPad';
import { ActionButton } from '../ui/ActionButton';
import { BattleState, type ActionResult } from '../battle/BattleState';
import { BattleEffects } from '../effects/BattleEffects';
import { LevelUpSystem } from '../systems/LevelUpSystem';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';
import type { EnemyData, PartyMember, ItemData } from '../data/types';

const BASE = import.meta.env.BASE_URL;

type BattlePhase = 'start' | 'command' | 'target' | 'battleItem' | 'battleItemTarget' | 'executing' | 'result' | 'victory' | 'defeat';

/** 戦闘背景のパーティクル */
interface BgParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  brightness: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

const COMMANDS = ['たたかう', 'じゅもん', 'どうぐ', 'ぼうぎょ', 'にげる'] as const;

/**
 * 戦闘シーン
 * - DQ風ターン制バトル
 * - コマンド選択 → 行動実行 → 結果表示
 */
export class BattleScene extends Scene {
  private battleState: BattleState;
  private phase: BattlePhase = 'start';
  private currentMemberIdx = 0;
  private commandCursor = 0;
  private targetCursor = 0;
  private partyActions: { type: string; targetIndex?: number; spellId?: string; itemId?: string }[] = [];
  private resultQueue: ActionResult[] = [];
  private currentResultIdx = 0;
  private messageText!: Text;
  private messageQueue: string[] = [];
  private messageIdx = 0;
  private onBattleEnd: (victory: boolean) => void;
  private itemDataMap: Map<string, ItemData> = new Map();
  private battleItems: { id: string; count: number; data: ItemData }[] = [];
  private selectedBattleItem: ItemData | null = null;
  private itemCursor = 0;
  private allyTargetCursor = 0;

  // UI containers
  private enemyArea = new Container();
  private statusArea = new Container();
  private commandArea = new Container();
  private messageArea = new Container();
  private effectLayer = new Container();

  // エフェクトシステム
  private effects!: BattleEffects;

  // 背景パーティクル
  private bgParticles: BgParticle[] = [];
  private bgGraphics = new Graphics();
  private bgAnimTimer = 0;

  // アクション結果キュー（エフェクト連携用）
  private actionResultQueue: ActionResult[] = [];

  constructor(game: Game, enemies: EnemyData[], onBattleEnd: (victory: boolean) => void) {
    super(game);
    this.battleState = new BattleState([...game.state.active], enemies);
    this.onBattleEnd = onBattleEnd;
  }

  async onEnter(): Promise<void> {
    this.game.audio.playBgm('battle');

    // アイテムマスタ読み込み
    const allItems = await this.game.content.loadJson<ItemData[]>('items/items.json');
    if (allItems) {
      for (const item of allItems) {
        this.itemDataMap.set(item.id, item);
      }
    }

    // 敵スプライトを事前ロード
    const spriteIds = [...new Set(this.battleState.enemies.map((e) => e.data.sprite).filter(Boolean))];
    await Promise.all(
      spriteIds.map((id) => Assets.load(`${BASE}assets/sprites/enemies/${id}.png`).catch(() => null))
    );

    this.drawBackground();
    this.drawEnemies();
    this.drawPartyStatus();
    this.drawMessageWindow();

    // エフェクトレイヤー（UIの上に配置）
    this.container.addChild(this.effectLayer);
    this.effects = new BattleEffects(this.effectLayer);

    // タッチUI（DPad + A/Bボタン）
    const dpad = new DPad(this.game.input);
    const actionBtn = new ActionButton(this.game.input);
    this.container.addChild(dpad.container);
    this.container.addChild(actionBtn.container);

    // 戦闘開始SE + トランジション
    this.game.audio.playSeOrSynth('battleStart');
    await this.effects.battleTransition();

    // 開始メッセージ
    const enemyNames = this.battleState.enemies.map((e) => e.data.name).join('と ');
    this.showMessages([`${enemyNames}が あらわれた！`], () => {
      this.phase = 'command';
      this.currentMemberIdx = this.findNextAliveMember(-1);
      this.partyActions = [];
      this.drawCommandWindow();
    });
  }

  private drawBackground(): void {
    // リッチグラデーション背景（暗い紺 → 紫 → 深い藍）
    const bg = new Graphics();
    const gradientSteps = 24;
    const stepH = Math.ceil(GAME_HEIGHT / gradientSteps);
    for (let i = 0; i < gradientSteps; i++) {
      const t = i / (gradientSteps - 1);
      // 上部は暗い紺、中間に紫味、下部は深い藍
      const r = Math.floor(0x04 + (0x18 - 0x04) * t * t);
      const g = Math.floor(0x04 + (0x08 - 0x04) * t);
      const b = Math.floor(0x18 + (0x38 - 0x18) * Math.sin(t * Math.PI * 0.8));
      const color = (r << 16) | (g << 8) | b;
      bg.rect(0, i * stepH, GAME_WIDTH, stepH + 1).fill(color);
    }

    // 地平線ライン
    const horizonY = GAME_HEIGHT * 0.4;
    bg.rect(0, horizonY - 1, GAME_WIDTH, 1).fill({ color: 0x303060, alpha: 0.5 });
    bg.rect(0, horizonY, GAME_WIDTH, 1).fill({ color: 0x202050, alpha: 0.3 });

    // 地面グラデーション（下半分）
    const groundSteps = 12;
    const groundH = GAME_HEIGHT * 0.15;
    const groundStartY = horizonY;
    for (let i = 0; i < groundSteps; i++) {
      const t = i / (groundSteps - 1);
      const gr = Math.floor(0x0c + t * 0x08);
      const gg = Math.floor(0x08 + t * 0x04);
      const gb = Math.floor(0x20 + t * 0x10);
      const gColor = (gr << 16) | (gg << 8) | gb;
      bg.rect(0, groundStartY + i * (groundH / groundSteps), GAME_WIDTH, groundH / groundSteps + 1)
        .fill(gColor);
    }

    this.container.addChild(bg);

    // 背景パーティクル（星/光の粒 - より多く、より立体的に）
    this.bgParticles = [];
    for (let i = 0; i < 50; i++) {
      this.bgParticles.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT * 0.38,
        speed: 0.05 + Math.random() * 0.2,
        size: Math.random() < 0.1 ? 2.5 : Math.random() < 0.3 ? 1.5 : 0.8,
        brightness: 0.2 + Math.random() * 0.8,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.015 + Math.random() * 0.035,
      });
    }
    this.container.addChild(this.bgGraphics);
  }

  private drawEnemies(): void {
    this.enemyArea.removeChildren();

    this.battleState.enemies.forEach((enemy, i) => {
      const ex = GAME_WIDTH / 2 - ((this.battleState.enemies.length - 1) * 70) / 2 + i * 70;
      const ey = 80;

      if (enemy.isAlive) {
        // 足元の影
        const shadow = new Graphics();
        shadow.ellipse(ex, ey + 34, 20, 5).fill({ color: 0x000000, alpha: 0.25 });
        this.enemyArea.addChild(shadow);

        // スプライト画像を試みる
        const spriteId = enemy.data.sprite;
        if (spriteId) {
          const tex = Assets.get<Texture>(`${BASE}assets/sprites/enemies/${spriteId}.png`);
          if (tex) {
            const sprite = new Sprite(tex);
            sprite.anchor.set(0.5);
            sprite.x = ex;
            sprite.y = ey;
            this.enemyArea.addChild(sprite);
          } else {
            this.drawEnemyFallback(ex, ey);
          }
        } else {
          this.drawEnemyFallback(ex, ey);
        }

        const name = new Text({ text: enemy.data.name, style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 9, fill: COLORS.TEXT }) });
        name.anchor.set(0.5);
        name.x = ex;
        name.y = ey + 40;
        this.enemyArea.addChild(name);

        // HP バー
        const hpRatio = enemy.currentHp / enemy.data.hp;
        const barW = 40;
        const bar = new Graphics();
        bar.rect(ex - barW / 2, ey + 48, barW, 3).fill(0x333333);
        bar.rect(ex - barW / 2, ey + 48, barW * hpRatio, 3).fill(hpRatio > 0.3 ? COLORS.HP_GREEN : COLORS.HP_RED);
        this.enemyArea.addChild(bar);
      }
    });

    this.container.addChild(this.enemyArea);
  }

  private drawEnemyFallback(ex: number, ey: number): void {
    const rect = new Graphics();
    // シャドウ
    rect.ellipse(ex, ey + 20, 16, 4).fill({ color: 0x000000, alpha: 0.3 });
    // ボディ（グラデーション風）
    rect.roundRect(ex - 16, ey - 16, 32, 32, 4).fill(0x882233);
    rect.roundRect(ex - 15, ey - 15, 30, 14, 3).fill({ color: 0xcc4455, alpha: 0.5 });
    // 目（2つの光点）
    rect.circle(ex - 5, ey - 4, 2).fill(0xffee88);
    rect.circle(ex + 5, ey - 4, 2).fill(0xffee88);
    // 枠
    rect.roundRect(ex - 16, ey - 16, 32, 32, 4).stroke({ color: 0xff6677, width: 1, alpha: 0.6 });
    this.enemyArea.addChild(rect);
  }

  private drawPartyStatus(): void {
    this.statusArea.removeChildren();
    const statusWin = new Window(8, GAME_HEIGHT - 200, GAME_WIDTH - 16, 90);
    this.statusArea.addChild(statusWin);

    const nameStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.TEXT });

    this.battleState.party.forEach((m, i) => {
      if (i >= 4) return;
      const x = 20;
      const y = GAME_HEIGHT - 192 + i * 20;

      // 戦闘不能時はグレー表示
      const isDead = m.hp <= 0;
      const nameColor = isDead ? COLORS.TEXT_DISABLED : COLORS.TEXT;
      const name = new Text({ text: m.name, style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: nameColor }) });
      name.x = x;
      name.y = y;
      this.statusArea.addChild(name);

      // HP テキスト
      const hpColor = isDead ? COLORS.HP_RED : m.hp < m.maxHp * 0.3 ? COLORS.HP_YELLOW : COLORS.HP_GREEN;
      const hp = new Text({
        text: `HP`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: 0x8888aa }),
      });
      hp.x = x + 72;
      hp.y = y + 1;
      this.statusArea.addChild(hp);

      const hpVal = new Text({
        text: `${m.hp.toString().padStart(3)}/${m.maxHp.toString().padStart(3)}`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: hpColor }),
      });
      hpVal.x = x + 90;
      hpVal.y = y;
      this.statusArea.addChild(hpVal);

      // HPバー
      const barX = x + 156;
      const barW = 50;
      const barH = 4;
      const barY = y + 6;
      const hpRatio = m.hp / m.maxHp;
      const bar = new Graphics();
      // バー背景
      bar.roundRect(barX, barY, barW, barH, 2).fill(0x181830);
      bar.roundRect(barX, barY, barW, barH, 2).stroke({ color: 0x303060, width: 0.5 });
      // バー本体
      if (hpRatio > 0) {
        bar.roundRect(barX, barY, barW * hpRatio, barH, 2).fill(hpColor);
        // ハイライト
        bar.roundRect(barX, barY, barW * hpRatio, barH * 0.4, 1).fill({ color: 0xffffff, alpha: 0.2 });
      }
      this.statusArea.addChild(bar);

      // MP テキスト
      const mp = new Text({
        text: `MP`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: 0x8888aa }),
      });
      mp.x = x + 212;
      mp.y = y + 1;
      this.statusArea.addChild(mp);

      const mpVal = new Text({
        text: `${m.mp.toString().padStart(2)}/${m.maxMp.toString().padStart(2)}`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.MP_BLUE }),
      });
      mpVal.x = x + 228;
      mpVal.y = y;
      this.statusArea.addChild(mpVal);
    });

    this.container.addChild(this.statusArea);
  }

  private drawMessageWindow(): void {
    this.messageArea.removeChildren();
    const msgWin = new Window(8, GAME_HEIGHT - 104, GAME_WIDTH - 16, 40);
    this.messageArea.addChild(msgWin);

    this.messageText = new Text({
      text: '',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    this.messageText.x = 20;
    this.messageText.y = GAME_HEIGHT - 96;
    this.messageArea.addChild(this.messageText);

    this.container.addChild(this.messageArea);
  }

  private drawCommandWindow(): void {
    this.commandArea.removeChildren();
    if (this.phase !== 'command') return;

    const member = this.battleState.party[this.currentMemberIdx];
    if (!member || member.hp <= 0) return;

    // メンバー名
    this.messageText.text = `${member.name}は どうする？`;

    const winW = 120;
    const winH = COMMANDS.length * 24 + 12;
    const cmdWin = new Window(8, 150, winW, winH);
    this.commandArea.addChild(cmdWin);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });

    COMMANDS.forEach((cmd, i) => {
      const text = new Text({ text: cmd, style });
      text.x = 32;
      text.y = 158 + i * 24;
      this.commandArea.addChild(text);
    });

    // カーソル
    const cursor = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.CURSOR }),
    });
    cursor.x = 16;
    cursor.y = 160 + this.commandCursor * 24;
    cursor.name = 'cmdCursor';
    this.commandArea.addChild(cursor);

    this.container.addChild(this.commandArea);
  }

  private drawTargetSelect(): void {
    this.commandArea.removeChildren();
    const aliveEnemies = this.battleState.enemies
      .map((e, i) => ({ enemy: e, index: i }))
      .filter((e) => e.enemy.isAlive);

    const winH = aliveEnemies.length * 24 + 12;
    const win = new Window(8, 150, 160, winH);
    this.commandArea.addChild(win);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });

    aliveEnemies.forEach((e, i) => {
      const text = new Text({ text: e.enemy.data.name, style });
      text.x = 32;
      text.y = 158 + i * 24;
      this.commandArea.addChild(text);
    });

    const cursor = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.CURSOR }),
    });
    cursor.x = 16;
    cursor.y = 160 + this.targetCursor * 24;
    this.commandArea.addChild(cursor);

    this.container.addChild(this.commandArea);
  }

  private showMessages(messages: string[], onComplete: () => void): void {
    this.messageQueue = messages;
    this.messageIdx = 0;
    this.messageText.text = messages[0] ?? '';
    this.phase = 'result';
    this._messageCallback = onComplete;
  }

  private _messageCallback?: () => void;

  private advanceMessage(): void {
    this.messageIdx++;
    if (this.messageIdx < this.messageQueue.length) {
      this.messageText.text = this.messageQueue[this.messageIdx];
    } else {
      // コールバック内でshowMessages()が呼ばれて新しいコールバックがセットされる場合があるため、
      // 先にクリアしてからコールバックを実行する
      const cb = this._messageCallback;
      this._messageCallback = undefined;
      cb?.();
    }
  }

  update(delta: number): void {
    const input = this.game.input;
    input.update();

    // 背景パーティクルアニメーション
    this.updateBackground(delta);

    switch (this.phase) {
      case 'result':
        if (input.isActionPressed) {
          this.game.audio.playSeOrSynth('confirm');
          this.advanceMessage();
        }
        break;

      case 'command':
        this.handleCommandInput(input);
        break;

      case 'target':
        this.handleTargetInput(input);
        break;

      case 'battleItem':
        this.handleBattleItemInput(input);
        break;

      case 'battleItemTarget':
        this.handleBattleItemTargetInput(input);
        break;

      case 'victory':
      case 'defeat':
        if (input.isActionPressed) {
          this.game.audio.playSeOrSynth('confirm');
          this.onBattleEnd(this.phase === 'victory');
        }
        break;
    }

    input.resetOneShot();
  }

  /** 背景パーティクルアニメーション更新 */
  private updateBackground(delta: number): void {
    this.bgAnimTimer += delta * 0.016;
    this.bgGraphics.clear();

    for (const p of this.bgParticles) {
      p.twinklePhase += p.twinkleSpeed * delta;
      const alpha = p.brightness * (0.3 + 0.7 * Math.abs(Math.sin(p.twinklePhase)));
      p.y += p.speed * delta * 0.08;

      // 画面外に出たら上に戻す
      if (p.y > GAME_HEIGHT * 0.38) {
        p.y = 0;
        p.x = Math.random() * GAME_WIDTH;
      }

      // 大きいパーティクルにはグロウ効果
      if (p.size >= 2) {
        this.bgGraphics.circle(p.x, p.y, p.size + 3).fill({ color: 0x4466aa, alpha: alpha * 0.1 });
        this.bgGraphics.circle(p.x, p.y, p.size + 1.5).fill({ color: 0x7799cc, alpha: alpha * 0.25 });
      }
      this.bgGraphics.circle(p.x, p.y, p.size).fill({ color: 0xc0d8f8, alpha });

      // 中心の白い点（明るい星）
      if (p.size >= 1.5) {
        this.bgGraphics.circle(p.x, p.y, p.size * 0.4).fill({ color: 0xeef4ff, alpha });
      }
    }
  }

  private handleCommandInput(input: { directionJustPressed: string | null; isActionPressed: boolean; isCancelPressed: boolean }): void {
    const dir = input.directionJustPressed;
    if (dir === 'up' && this.commandCursor > 0) {
      this.commandCursor--;
      this.game.audio.playSeOrSynth('cursor');
      this.drawCommandWindow();
    } else if (dir === 'down' && this.commandCursor < COMMANDS.length - 1) {
      this.commandCursor++;
      this.game.audio.playSeOrSynth('cursor');
      this.drawCommandWindow();
    }

    if (input.isActionPressed) {
      this.game.audio.playSeOrSynth('confirm');
      switch (this.commandCursor) {
        case 0: // たたかう
          this.phase = 'target';
          this.targetCursor = 0;
          this.drawTargetSelect();
          break;
        case 3: // ぼうぎょ
          this.partyActions.push({ type: 'defend' });
          this.battleState.partyDefending.add(this.currentMemberIdx);
          this.nextMemberOrExecute();
          break;
        case 4: // にげる
          this.executeFlee();
          break;
        case 1:
          // じゅもんは後のPhaseで
          this.messageText.text = 'まだ つかえません。';
          break;
        case 2: // どうぐ
          this.openBattleItemSelect();
          break;
      }
    }

    if (input.isCancelPressed && this.currentMemberIdx > 0) {
      this.game.audio.playSeOrSynth('cancel');
      // 前のメンバーに戻る
      this.partyActions.pop();
      this.currentMemberIdx = this.findPrevAliveMember(this.currentMemberIdx);
      this.commandCursor = 0;
      this.drawCommandWindow();
    }
  }

  private handleTargetInput(input: { directionJustPressed: string | null; isActionPressed: boolean; isCancelPressed: boolean }): void {
    const aliveEnemies = this.battleState.enemies
      .map((e, i) => ({ enemy: e, index: i }))
      .filter((e) => e.enemy.isAlive);

    const dir = input.directionJustPressed;
    if (dir === 'up' && this.targetCursor > 0) {
      this.targetCursor--;
      this.game.audio.playSeOrSynth('cursor');
      this.drawTargetSelect();
    } else if (dir === 'down' && this.targetCursor < aliveEnemies.length - 1) {
      this.targetCursor++;
      this.game.audio.playSeOrSynth('cursor');
      this.drawTargetSelect();
    }

    if (input.isActionPressed) {
      this.game.audio.playSeOrSynth('confirm');
      const target = aliveEnemies[this.targetCursor];
      this.partyActions.push({ type: 'attack', targetIndex: target.index });
      this.nextMemberOrExecute();
    }

    if (input.isCancelPressed) {
      this.game.audio.playSeOrSynth('cancel');
      this.phase = 'command';
      this.commandCursor = 0;
      this.drawCommandWindow();
    }
  }

  private openBattleItemSelect(): void {
    // 戦闘で使えるアイテムをフィルタ
    this.battleItems = [];
    for (const invItem of this.game.state.items) {
      const data = this.itemDataMap.get(invItem.id);
      if (data && data.usableInBattle) {
        this.battleItems.push({ id: invItem.id, count: invItem.count, data });
      }
    }

    if (this.battleItems.length === 0) {
      this.messageText.text = 'つかえる どうぐが ない！';
      return;
    }

    this.phase = 'battleItem';
    this.itemCursor = 0;
    this.drawBattleItemSelect();
  }

  private drawBattleItemSelect(): void {
    this.commandArea.removeChildren();

    const winH = this.battleItems.length * 24 + 12;
    const win = new Window(8, 150, 180, winH);
    this.commandArea.addChild(win);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });
    const countStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.TEXT_DISABLED });

    this.battleItems.forEach((item, i) => {
      const text = new Text({ text: item.data.name, style });
      text.x = 32;
      text.y = 158 + i * 24;
      this.commandArea.addChild(text);

      const count = new Text({ text: `x${item.count}`, style: countStyle });
      count.x = 150;
      count.y = 158 + i * 24;
      this.commandArea.addChild(count);
    });

    const cursor = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.CURSOR }),
    });
    cursor.x = 16;
    cursor.y = 160 + this.itemCursor * 24;
    this.commandArea.addChild(cursor);

    this.container.addChild(this.commandArea);
  }

  private handleBattleItemInput(input: { directionJustPressed: string | null; isActionPressed: boolean; isCancelPressed: boolean }): void {
    const dir = input.directionJustPressed;
    if (dir === 'up' && this.itemCursor > 0) {
      this.itemCursor--;
      this.game.audio.playSeOrSynth('cursor');
      this.drawBattleItemSelect();
    } else if (dir === 'down' && this.itemCursor < this.battleItems.length - 1) {
      this.itemCursor++;
      this.game.audio.playSeOrSynth('cursor');
      this.drawBattleItemSelect();
    }

    if (input.isActionPressed) {
      this.game.audio.playSeOrSynth('confirm');
      this.selectedBattleItem = this.battleItems[this.itemCursor].data;
      const target = this.selectedBattleItem.target;

      if (target === 'oneAlly' || target === 'self') {
        this.phase = 'battleItemTarget';
        this.allyTargetCursor = 0;
        this.drawAllyTargetSelect();
      } else {
        this.partyActions.push({ type: 'item', itemId: this.selectedBattleItem.id, targetIndex: 0 });
        this.nextMemberOrExecute();
      }
    }

    if (input.isCancelPressed) {
      this.game.audio.playSeOrSynth('cancel');
      this.phase = 'command';
      this.commandCursor = 0;
      this.drawCommandWindow();
    }
  }

  private drawAllyTargetSelect(): void {
    this.commandArea.removeChildren();

    const party = this.battleState.party;
    const winH = party.length * 24 + 12;
    const win = new Window(8, 150, 200, winH);
    this.commandArea.addChild(win);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });

    party.forEach((m, i) => {
      const hpColor = m.hp <= 0 ? COLORS.HP_RED : m.hp < m.maxHp * 0.3 ? COLORS.HP_YELLOW : COLORS.HP_GREEN;
      const text = new Text({ text: m.name, style });
      text.x = 32;
      text.y = 158 + i * 24;
      this.commandArea.addChild(text);

      const hp = new Text({
        text: `HP${m.hp}/${m.maxHp}`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: hpColor }),
      });
      hp.x = 110;
      hp.y = 158 + i * 24;
      this.commandArea.addChild(hp);
    });

    const cursor = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.CURSOR }),
    });
    cursor.x = 16;
    cursor.y = 160 + this.allyTargetCursor * 24;
    this.commandArea.addChild(cursor);

    this.container.addChild(this.commandArea);
  }

  private handleBattleItemTargetInput(input: { directionJustPressed: string | null; isActionPressed: boolean; isCancelPressed: boolean }): void {
    const party = this.battleState.party;
    const dir = input.directionJustPressed;
    if (dir === 'up' && this.allyTargetCursor > 0) {
      this.allyTargetCursor--;
      this.game.audio.playSeOrSynth('cursor');
      this.drawAllyTargetSelect();
    } else if (dir === 'down' && this.allyTargetCursor < party.length - 1) {
      this.allyTargetCursor++;
      this.game.audio.playSeOrSynth('cursor');
      this.drawAllyTargetSelect();
    }

    if (input.isActionPressed && this.selectedBattleItem) {
      this.game.audio.playSeOrSynth('confirm');
      this.partyActions.push({ type: 'item', itemId: this.selectedBattleItem.id, targetIndex: this.allyTargetCursor });
      this.nextMemberOrExecute();
    }

    if (input.isCancelPressed) {
      this.game.audio.playSeOrSynth('cancel');
      this.phase = 'battleItem';
      this.drawBattleItemSelect();
    }
  }

  private nextMemberOrExecute(): void {
    const next = this.findNextAliveMember(this.currentMemberIdx);
    if (next >= 0 && this.partyActions.length < this.getAlivePartyCount()) {
      this.currentMemberIdx = next;
      this.commandCursor = 0;
      this.phase = 'command';
      this.drawCommandWindow();
    } else {
      this.executeTurn();
    }
  }

  private executeTurn(): void {
    this.battleState.turnCount++;
    this.commandArea.removeChildren();

    // 行動順序: 速度ベースで並べる
    const allActions: { speed: number; execute: () => ActionResult }[] = [];

    // パーティの行動
    let actionIdx = 0;
    for (let i = 0; i < this.battleState.party.length; i++) {
      const m = this.battleState.party[i];
      if (m.hp <= 0) continue;
      const action = this.partyActions[actionIdx++];
      if (!action) continue;

      allActions.push({
        speed: m.speed + Math.random() * 10,
        execute: () => {
          if (action.type === 'attack' && action.targetIndex !== undefined) {
            let targetIdx = action.targetIndex;
            if (!this.battleState.enemies[targetIdx].isAlive) {
              const alive = this.battleState.enemies.findIndex((e) => e.isAlive);
              if (alive < 0) return this.emptyResult(m.name);
              targetIdx = alive;
            }
            return this.battleState.executePartyAttack(i, targetIdx);
          }
          if (action.type === 'defend') {
            return {
              action: { type: 'defend' as const, actor: 'party' as const, actorIndex: i },
              actorName: m.name,
              missed: false,
              critical: false,
              messages: [`${m.name}は みをまもっている。`],
              targetDied: false,
            };
          }
          if (action.type === 'item' && action.itemId) {
            return this.executeItemAction(m, action.itemId, action.targetIndex ?? i);
          }
          return this.emptyResult(m.name);
        },
      });
    }

    // 敵の行動
    this.battleState.enemies.forEach((enemy, i) => {
      if (!enemy.isAlive) return;
      allActions.push({
        speed: enemy.data.speed + Math.random() * 10,
        execute: () => this.battleState.executeEnemyAction(i),
      });
    });

    // 速度順ソート
    allActions.sort((a, b) => b.speed - a.speed);

    // 順次実行して結果を収集（エフェクト連携用）
    this.actionResultQueue = [];
    for (const action of allActions) {
      if (this.battleState.isOver) break;
      const result = action.execute();
      this.actionResultQueue.push(result);
      const status = this.battleState.checkBattleEnd();
      if (status !== 'continue') break;
    }

    // ぼうぎょリセット
    this.battleState.partyDefending.clear();

    // アクション結果を1つずつエフェクト付きで表示
    this.showActionResultSequence(0, () => {
      // ステータス最終更新
      this.drawPartyStatus();
      this.drawEnemies();

      const status = this.battleState.checkBattleEnd();
      if (status === 'victory') {
        this.showVictory();
      } else if (status === 'defeat') {
        this.showDefeat();
      } else {
        this.currentMemberIdx = this.findNextAliveMember(-1);
        this.partyActions = [];
        this.commandCursor = 0;
        this.phase = 'command';
        this.drawCommandWindow();
      }
    });
  }

  /** アクション結果を1つずつエフェクト付きで表示 */
  private showActionResultSequence(idx: number, onComplete: () => void): void {
    if (idx >= this.actionResultQueue.length) {
      onComplete();
      return;
    }

    const result = this.actionResultQueue[idx];
    if (result.messages.length === 0) {
      this.showActionResultSequence(idx + 1, onComplete);
      return;
    }

    // アクションに応じたエフェクトとSEを再生
    this.playActionEffects(result);

    // ステータス中間更新
    this.drawPartyStatus();
    this.drawEnemies();

    // メッセージ表示後に次のアクションへ
    this.showMessages(result.messages, () => {
      this.showActionResultSequence(idx + 1, onComplete);
    });
  }

  /** アクション結果に応じたエフェクトとSE再生 */
  private playActionEffects(result: ActionResult): void {
    if (result.action.type === 'defend') {
      this.game.audio.playSeOrSynth('defend');
      return;
    }

    if (result.missed) {
      this.game.audio.playSeOrSynth('miss');
      return;
    }

    const isPartyAttack = result.action.actor === 'party' && result.action.type === 'attack';
    const isEnemyAttack = result.action.actor === 'enemy' && result.action.type === 'attack';

    if (isPartyAttack && result.damage && result.damage > 0) {
      // 味方の攻撃 → 敵にエフェクト
      const enemyIdx = result.action.targetIndex ?? 0;
      const enemyPos = this.getEnemyPosition(enemyIdx);

      if (result.critical) {
        this.game.audio.playSeOrSynth('critical');
        this.effects.flash(0xffff00, 0.5, 300);
        this.effects.shake(this.enemyArea, 8, 400);
        this.effects.showSlash(enemyPos.x, enemyPos.y);
        this.effects.showDamage(enemyPos.x, enemyPos.y - 25, result.damage, true);
      } else {
        this.game.audio.playSeOrSynth('attack');
        this.effects.flash(0xffffff, 0.3, 150);
        this.effects.shake(this.enemyArea, 3, 200);
        this.effects.showSlash(enemyPos.x, enemyPos.y);
        this.effects.showDamage(enemyPos.x, enemyPos.y - 25, result.damage, false);
      }

      if (result.targetDied) {
        this.game.audio.playSeOrSynth('enemyDeath');
      }
    }

    if (isEnemyAttack && result.damage && result.damage > 0) {
      // 敵の攻撃 → 画面シェイク + 赤フラッシュ
      if (result.critical) {
        this.game.audio.playSeOrSynth('critical');
        this.effects.flash(0xff0000, 0.5, 300);
        this.effects.shake(this.container, 6, 400);
      } else {
        this.game.audio.playSeOrSynth('damage');
        this.effects.flash(0xff0000, 0.3, 200);
        this.effects.shake(this.container, 3, 200);
      }
    }

    // 回復系アイテム
    if (result.healed && result.healed > 0) {
      this.game.audio.playSeOrSynth('heal');
      this.effects.flash(0x00ff88, 0.2, 300);
      this.effects.showHealSparkle(GAME_WIDTH / 2, GAME_HEIGHT - 160);
    }
  }

  /** 敵の表示位置を取得 */
  private getEnemyPosition(enemyIdx: number): { x: number; y: number } {
    const total = this.battleState.enemies.length;
    const ex = GAME_WIDTH / 2 - ((total - 1) * 70) / 2 + enemyIdx * 70;
    const ey = 80;
    return { x: ex, y: ey };
  }

  private executeFlee(): void {
    const result = this.battleState.attemptFlee();
    if (result.success) {
      this.game.audio.playSeOrSynth('flee');
    }
    this.showMessages(result.messages, () => {
      if (result.success) {
        this.onBattleEnd(false);
      } else {
        // 逃走失敗 → 敵のターン
        const enemyMessages: string[] = [];
        for (const enemy of this.battleState.enemies) {
          if (!enemy.isAlive) continue;
          const idx = this.battleState.enemies.indexOf(enemy);
          const actionResult = this.battleState.executeEnemyAction(idx);
          enemyMessages.push(...actionResult.messages);
          if (this.battleState.checkBattleEnd() !== 'continue') break;
        }

        this.drawPartyStatus();

        if (enemyMessages.length > 0) {
          this.showMessages(enemyMessages, () => {
            const status = this.battleState.checkBattleEnd();
            if (status === 'defeat') {
              this.showDefeat();
            } else {
              this.currentMemberIdx = this.findNextAliveMember(-1);
              this.partyActions = [];
              this.commandCursor = 0;
              this.phase = 'command';
              this.drawCommandWindow();
            }
          });
        } else {
          this.currentMemberIdx = this.findNextAliveMember(-1);
          this.partyActions = [];
          this.phase = 'command';
          this.drawCommandWindow();
        }
      }
    });
  }

  private showVictory(): void {
    // 勝利エフェクト
    this.effects.victoryFlash();
    this.game.audio.playSeOrSynth('victory');

    const rewards = this.battleState.getVictoryRewards();
    const messages: string[] = [];
    messages.push('てきを やっつけた！');
    messages.push(`${rewards.exp}の けいけんちを かくとく！`);
    messages.push(`${rewards.gold}ゴールドを てにいれた！`);

    this.game.state.gold += rewards.gold;

    // 経験値分配
    const aliveMembers = this.battleState.party.filter((m) => m.hp > 0);
    const expEach = Math.floor(rewards.exp / Math.max(1, aliveMembers.length));
    for (const m of aliveMembers) {
      m.exp += expEach;
    }

    // ドロップアイテム
    for (const drop of rewards.drops) {
      messages.push(`${drop.name}を てにいれた！`);
      this.game.state.addItem(drop.id);
    }

    // GameStateのパーティを更新
    for (let i = 0; i < this.game.state.active.length; i++) {
      const battleMember = this.battleState.party[i];
      if (battleMember) {
        this.game.state.active[i].hp = battleMember.hp;
        this.game.state.active[i].mp = battleMember.mp;
        this.game.state.active[i].exp = battleMember.exp;
      }
    }

    // レベルアップチェック
    let hasLevelUp = false;
    for (const member of this.game.state.active) {
      const results = this.game.levelUp.processAllLevelUps(member);
      for (const result of results) {
        if (!hasLevelUp) {
          hasLevelUp = true;
          this.game.audio.playSeOrSynth('levelUp');
          this.effects.flash(0xffff00, 0.4, 500);
        }
        messages.push(...LevelUpSystem.generateMessages(result));
      }
    }

    this.phase = 'result';
    this.showMessages(messages, () => {
      this.phase = 'victory';
      this.messageText.text = '▼ つづける';
    });
  }

  private showDefeat(): void {
    // 全滅エフェクト（暗転）
    this.effects.flash(0xff0000, 0.6, 800);
    this.showMessages(['ぜんめつしてしまった...'], () => {
      this.phase = 'defeat';
      this.messageText.text = '▼ つづける';
    });
  }

  private executeItemAction(actor: PartyMember, itemId: string, targetIndex: number): ActionResult {
    const itemData = this.itemDataMap.get(itemId);
    if (!itemData) return this.emptyResult(actor.name);

    const messages: string[] = [`${actor.name}は ${itemData.name}を つかった！`];

    if (itemData.type === 'heal' && itemData.effect.hp) {
      const target = this.battleState.party[targetIndex];
      if (target.hp <= 0) {
        messages.push(`しかし ${target.name}は しんでいる！`);
      } else {
        const healAmount = Math.min(itemData.effect.hp, target.maxHp - target.hp);
        target.hp = Math.min(target.maxHp, target.hp + healAmount);
        this.game.state.useItem(itemId);
        messages.push(`${target.name}の HPが ${healAmount} かいふくした！`);
      }
    } else if (itemData.type === 'status_cure' && itemData.effect.cureStatus) {
      const target = this.battleState.party[targetIndex];
      const cured = target.statusEffects.filter((s) =>
        itemData.effect.cureStatus!.includes(s.type)
      );
      if (cured.length === 0) {
        messages.push('しかし なにも おこらなかった！');
      } else {
        target.statusEffects = target.statusEffects.filter(
          (s) => !itemData.effect.cureStatus!.includes(s.type)
        );
        this.game.state.useItem(itemId);
        messages.push(`${target.name}の じょうたいが かいふくした！`);
      }
    } else if (itemData.type === 'revive') {
      const target = this.battleState.party[targetIndex];
      if (target.hp > 0) {
        messages.push(`${target.name}は いきている！`);
      } else {
        const reviveHp = Math.floor(target.maxHp * (itemData.effect.reviveHpPercent ?? 0.5));
        target.hp = Math.max(1, reviveHp);
        this.game.state.useItem(itemId);
        messages.push(`${target.name}は いきかえった！`);
      }
    } else {
      messages.push('しかし なにも おこらなかった！');
    }

    return {
      action: { type: 'attack' as const, actor: 'party' as const, actorIndex: 0 },
      actorName: actor.name,
      missed: false,
      critical: false,
      messages,
      targetDied: false,
    };
  }

  private emptyResult(actorName: string): ActionResult {
    return {
      action: { type: 'attack', actor: 'party', actorIndex: 0 },
      actorName,
      missed: false,
      critical: false,
      messages: [],
      targetDied: false,
    };
  }

  private findNextAliveMember(afterIndex: number): number {
    for (let i = afterIndex + 1; i < this.battleState.party.length; i++) {
      if (this.battleState.party[i].hp > 0) return i;
    }
    return -1;
  }

  private findPrevAliveMember(beforeIndex: number): number {
    for (let i = beforeIndex - 1; i >= 0; i--) {
      if (this.battleState.party[i].hp > 0) return i;
    }
    return beforeIndex;
  }

  private getAlivePartyCount(): number {
    return this.battleState.party.filter((m) => m.hp > 0).length;
  }
}

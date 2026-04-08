import { Graphics, Text, TextStyle, Container, Sprite, Texture, Assets } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { DPad } from '../ui/DPad';
import { ActionButton } from '../ui/ActionButton';
import { BattleState, type ActionResult } from '../battle/BattleState';
import { LevelUpSystem } from '../systems/LevelUpSystem';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';
import type { EnemyData, PartyMember, ItemData } from '../data/types';

const BASE = import.meta.env.BASE_URL;

type BattlePhase = 'start' | 'command' | 'target' | 'battleItem' | 'battleItemTarget' | 'executing' | 'result' | 'victory' | 'defeat';

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

    // タッチUI（DPad + A/Bボタン）
    const dpad = new DPad(this.game.input);
    const actionBtn = new ActionButton(this.game.input);
    this.container.addChild(dpad.container);
    this.container.addChild(actionBtn.container);

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
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0x111122);
    this.container.addChild(bg);
  }

  private drawEnemies(): void {
    this.enemyArea.removeChildren();

    this.battleState.enemies.forEach((enemy, i) => {
      const ex = GAME_WIDTH / 2 - ((this.battleState.enemies.length - 1) * 70) / 2 + i * 70;
      const ey = 80;

      if (enemy.isAlive) {
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
    rect.rect(ex - 16, ey - 16, 32, 32).fill(0xcc3333);
    rect.rect(ex - 16, ey - 16, 32, 32).stroke({ color: COLORS.WHITE, width: 1 });
    this.enemyArea.addChild(rect);
  }

  private drawPartyStatus(): void {
    this.statusArea.removeChildren();
    const statusWin = new Window(8, GAME_HEIGHT - 200, GAME_WIDTH - 16, 90);
    this.statusArea.addChild(statusWin);

    const nameStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.TEXT });
    const hpStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.TEXT });

    this.battleState.party.forEach((m, i) => {
      if (i >= 4) return;
      const x = 20;
      const y = GAME_HEIGHT - 192 + i * 20;

      const name = new Text({ text: m.name, style: nameStyle });
      name.x = x;
      name.y = y;
      this.statusArea.addChild(name);

      const hpColor = m.hp <= 0 ? COLORS.HP_RED : m.hp < m.maxHp * 0.3 ? COLORS.HP_YELLOW : COLORS.HP_GREEN;
      const hp = new Text({
        text: `HP ${m.hp.toString().padStart(3)}/${m.maxHp.toString().padStart(3)}  MP ${m.mp.toString().padStart(2)}/${m.maxMp.toString().padStart(2)}`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: hpColor }),
      });
      hp.x = x + 80;
      hp.y = y;
      this.statusArea.addChild(hp);
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

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    switch (this.phase) {
      case 'result':
        if (input.isActionPressed) {
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
          this.onBattleEnd(this.phase === 'victory');
        }
        break;
    }

    input.resetOneShot();
  }

  private handleCommandInput(input: { directionJustPressed: string | null; isActionPressed: boolean; isCancelPressed: boolean }): void {
    const dir = input.directionJustPressed;
    if (dir === 'up' && this.commandCursor > 0) {
      this.commandCursor--;
      this.drawCommandWindow();
    } else if (dir === 'down' && this.commandCursor < COMMANDS.length - 1) {
      this.commandCursor++;
      this.drawCommandWindow();
    }

    if (input.isActionPressed) {
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
      this.drawTargetSelect();
    } else if (dir === 'down' && this.targetCursor < aliveEnemies.length - 1) {
      this.targetCursor++;
      this.drawTargetSelect();
    }

    if (input.isActionPressed) {
      const target = aliveEnemies[this.targetCursor];
      this.partyActions.push({ type: 'attack', targetIndex: target.index });
      this.nextMemberOrExecute();
    }

    if (input.isCancelPressed) {
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
      this.drawBattleItemSelect();
    } else if (dir === 'down' && this.itemCursor < this.battleItems.length - 1) {
      this.itemCursor++;
      this.drawBattleItemSelect();
    }

    if (input.isActionPressed) {
      this.selectedBattleItem = this.battleItems[this.itemCursor].data;
      const target = this.selectedBattleItem.target;

      if (target === 'oneAlly' || target === 'self') {
        // 味方選択へ
        this.phase = 'battleItemTarget';
        this.allyTargetCursor = 0;
        this.drawAllyTargetSelect();
      } else {
        // allAllies等: 即決定（最初のメンバーをターゲットに記録）
        this.partyActions.push({ type: 'item', itemId: this.selectedBattleItem.id, targetIndex: 0 });
        this.nextMemberOrExecute();
      }
    }

    if (input.isCancelPressed) {
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
      this.drawAllyTargetSelect();
    } else if (dir === 'down' && this.allyTargetCursor < party.length - 1) {
      this.allyTargetCursor++;
      this.drawAllyTargetSelect();
    }

    if (input.isActionPressed && this.selectedBattleItem) {
      this.partyActions.push({ type: 'item', itemId: this.selectedBattleItem.id, targetIndex: this.allyTargetCursor });
      this.nextMemberOrExecute();
    }

    if (input.isCancelPressed) {
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
            // ターゲットが倒されていたら別の敵を狙う
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

    // 順次実行して結果メッセージを収集
    const allMessages: string[] = [];
    for (const action of allActions) {
      if (this.battleState.isOver) break;
      const result = action.execute();
      allMessages.push(...result.messages);

      const status = this.battleState.checkBattleEnd();
      if (status !== 'continue') break;
    }

    // ぼうぎょリセット
    this.battleState.partyDefending.clear();

    // ステータス更新
    this.drawPartyStatus();
    this.drawEnemies();

    // 結果メッセージ表示
    this.showMessages(allMessages, () => {
      const status = this.battleState.checkBattleEnd();
      if (status === 'victory') {
        this.showVictory();
      } else if (status === 'defeat') {
        this.showDefeat();
      } else {
        // 次のターン
        this.currentMemberIdx = this.findNextAliveMember(-1);
        this.partyActions = [];
        this.commandCursor = 0;
        this.phase = 'command';
        this.drawCommandWindow();
      }
    });
  }

  private executeFlee(): void {
    const result = this.battleState.attemptFlee();
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
    for (const member of this.game.state.active) {
      const results = this.game.levelUp.processAllLevelUps(member);
      for (const result of results) {
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

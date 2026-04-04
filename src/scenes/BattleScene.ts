import { Graphics, Text, TextStyle, Container } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { DPad } from '../ui/DPad';
import { ActionButton } from '../ui/ActionButton';
import { BattleState, type ActionResult } from '../battle/BattleState';
import { LevelUpSystem } from '../systems/LevelUpSystem';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';
import type { EnemyData, PartyMember } from '../data/types';

type BattlePhase = 'start' | 'command' | 'target' | 'executing' | 'result' | 'victory' | 'defeat';

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

  onEnter(): void {
    this.game.audio.playBgm('battle');

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
    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fill: COLORS.TEXT });

    this.battleState.enemies.forEach((enemy, i) => {
      // 仮表示（スプライトがないのでテキスト+矩形で代替）
      const ex = GAME_WIDTH / 2 - ((this.battleState.enemies.length - 1) * 50) / 2 + i * 50;
      const ey = 80;

      if (enemy.isAlive) {
        const rect = new Graphics();
        rect.rect(ex - 16, ey - 16, 32, 32).fill(0xcc3333);
        rect.rect(ex - 16, ey - 16, 32, 32).stroke({ color: COLORS.WHITE, width: 1 });
        this.enemyArea.addChild(rect);

        const name = new Text({ text: enemy.data.name, style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 9, fill: COLORS.TEXT }) });
        name.anchor.set(0.5);
        name.x = ex;
        name.y = ey + 24;
        this.enemyArea.addChild(name);

        // HP バー
        const hpRatio = enemy.currentHp / enemy.data.hp;
        const barW = 28;
        const bar = new Graphics();
        bar.rect(ex - barW / 2, ey + 32, barW, 3).fill(0x333333);
        bar.rect(ex - barW / 2, ey + 32, barW * hpRatio, 3).fill(hpRatio > 0.3 ? COLORS.HP_GREEN : COLORS.HP_RED);
        this.enemyArea.addChild(bar);
      }
    });

    this.container.addChild(this.enemyArea);
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
        default:
          // じゅもん/どうぐは後のPhaseで
          this.messageText.text = 'まだ つかえません。';
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

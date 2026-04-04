import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { ChoiceWindow } from '../ui/ChoiceWindow';
import { SaveManager } from '../systems/SaveManager';
import { SaveSlotScene } from './SaveSlotScene';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';

const SERVICES = ['おいのりをする', 'いきかえらせる', 'どくのちりょう', 'のろいをとく', 'やめる'] as const;

/**
 * 教会シーン
 * - セーブ（おいのりをする）
 * - 復活（いきかえらせる）
 * - 毒治療 / 呪い解除
 */
export class ChurchScene extends Scene {
  private cursorIndex = 0;
  private cursorText!: Text;
  private msgText!: Text;
  private onClose: () => void;
  private currentMap: string;
  private playerX: number;
  private playerY: number;

  constructor(game: Game, onClose: () => void, currentMap: string, playerX: number, playerY: number) {
    super(game);
    this.onClose = onClose;
    this.currentMap = currentMap;
    this.playerX = playerX;
    this.playerY = playerY;
  }

  onEnter(): void {
    this.drawMenu();
  }

  private drawMenu(): void {
    this.container.removeChildren();

    const msgWin = new Window(8, 8, GAME_WIDTH - 16, 60);
    this.container.addChild(msgWin);

    this.msgText = new Text({
      text: 'ようこそ おまいりくださいました。\nどのような ごようけんですか？',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    this.msgText.x = 20;
    this.msgText.y = 18;
    this.container.addChild(this.msgText);

    const menuWin = new Window(8, 80, 180, SERVICES.length * 26 + 12);
    this.container.addChild(menuWin);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });
    SERVICES.forEach((s, i) => {
      const text = new Text({ text: s, style });
      text.x = 32;
      text.y = 90 + i * 26;
      this.container.addChild(text);
    });

    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.CURSOR }),
    });
    this.cursorIndex = 0;
    this.updateCursor();
    this.container.addChild(this.cursorText);
  }

  private updateCursor(): void {
    this.cursorText.x = 16;
    this.cursorText.y = 92 + this.cursorIndex * 26;
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    const dir = input.directionJustPressed;
    if (dir === 'up' && this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateCursor();
    } else if (dir === 'down' && this.cursorIndex < SERVICES.length - 1) {
      this.cursorIndex++;
      this.updateCursor();
    }

    if (input.isActionPressed) {
      switch (this.cursorIndex) {
        case 0: this.doSave(); break;
        case 1: this.doRevive(); break;
        case 2: this.doCurePoison(); break;
        case 3: this.doRemoveCurse(); break;
        case 4: this.onClose(); break;
      }
    }

    if (input.isCancelPressed) {
      this.onClose();
    }

    input.resetOneShot();
  }

  private doSave(): void {
    const saveManager = new SaveManager(this.game);
    // セーブスロット選択画面へ
    const saveScene = new SaveSlotScene(
      this.game,
      'save',
      (slotId) => {
        saveManager.save(
          slotId,
          this.game.state.toPartyData(),
          this.currentMap,
          this.playerX,
          this.playerY,
          this.game.state.playTime
        );
        this.msgText.text = 'おいのりを ささげました。\nぼうけんのしょに きろくしました。';
        // 戻る
        setTimeout(() => this.drawMenu(), 0);
      },
      () => this.drawMenu()
    );
    // オーバーレイとして表示
    this.container.removeChildren();
    this.container.addChild(saveScene.container);
    saveScene.onEnter();
  }

  private doRevive(): void {
    const dead = this.game.state.allMembers.filter((m) => m.hp <= 0);
    if (dead.length === 0) {
      this.msgText.text = 'いきかえらせる ひつようは ないようです。';
      return;
    }
    // 最初の死亡メンバーを復活（簡略化）
    const member = dead[0];
    member.hp = Math.floor(member.maxHp / 2);
    member.statusEffects = member.statusEffects.filter((e) => e.type !== 'death');
    this.msgText.text = `${member.name}は いきかえった！`;
  }

  private doCurePoison(): void {
    const poisoned = this.game.state.allMembers.filter((m) =>
      m.statusEffects.some((e) => e.type === 'poison')
    );
    if (poisoned.length === 0) {
      this.msgText.text = 'どくに おかされている ものは いません。';
      return;
    }
    for (const m of poisoned) {
      m.statusEffects = m.statusEffects.filter((e) => e.type !== 'poison');
    }
    this.msgText.text = 'どくを ちりょうしました。';
  }

  private doRemoveCurse(): void {
    const cursed = this.game.state.allMembers.filter((m) =>
      m.statusEffects.some((e) => e.type === 'curse')
    );
    if (cursed.length === 0) {
      this.msgText.text = 'のろいを うけている ものは いません。';
      return;
    }
    for (const m of cursed) {
      m.statusEffects = m.statusEffects.filter((e) => e.type !== 'curse');
    }
    this.msgText.text = 'のろいを といた！';
  }
}

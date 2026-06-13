import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';
import type { PartyMember, SpellData } from '../data/types';

/**
 * フィールド呪文画面
 * - 唱える人 → 呪文 → 対象 の順に選択
 * - 回復呪文をフィールドで使用可能
 */
export class SpellScene extends Scene {
  private phase: 'caster' | 'spell' | 'target' | 'message' = 'caster';
  private casterCursor = 0;
  private spellCursor = 0;
  private targetCursor = 0;
  private cursorText!: Text;
  private onClose: () => void;
  private caster: PartyMember | null = null;
  private casterSpells: SpellData[] = [];
  private selectedSpell: SpellData | null = null;
  private messageTimer = 0;

  constructor(game: Game, onClose: () => void) {
    super(game);
    this.onClose = onClose;
  }

  onEnter(): void {
    this.drawCasterSelect();
  }

  /** メンバーのフィールドで使える呪文一覧 */
  private getFieldSpells(member: PartyMember): SpellData[] {
    return member.spells
      .map((id) => this.game.spells.get(id))
      .filter((s): s is SpellData => !!s && s.usableInField);
  }

  private drawHint(text: string): void {
    const hint = new Text({
      text,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: COLORS.TEXT_DISABLED }),
    });
    hint.anchor.set(0.5);
    hint.x = GAME_WIDTH / 2;
    hint.y = GAME_HEIGHT - 24;
    this.container.addChild(hint);
  }

  private drawCursor(x: number, y: number): void {
    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.CURSOR }),
    });
    this.cursorText.x = x;
    this.cursorText.y = y;
    this.container.addChild(this.cursorText);
  }

  private drawCasterSelect(): void {
    this.container.removeChildren();
    this.phase = 'caster';

    const members = this.game.state.active;

    const titleWin = new Window(8, 8, GAME_WIDTH - 16, 36);
    this.container.addChild(titleWin);
    const title = new Text({
      text: 'だれが じゅもんを つかう？',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    title.x = 20;
    title.y = 18;
    this.container.addChild(title);

    const listWin = new Window(8, 52, GAME_WIDTH - 16, members.length * 32 + 16);
    this.container.addChild(listWin);

    members.forEach((m, i) => {
      const hasSpells = this.getFieldSpells(m).length > 0;
      const style = new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        fill: hasSpells ? COLORS.TEXT : COLORS.TEXT_DISABLED,
      });
      const text = new Text({ text: m.name, style });
      text.x = 36;
      text.y = 62 + i * 32;
      this.container.addChild(text);

      const mp = new Text({
        text: `MP ${m.mp}/${m.maxMp}`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.MP_BLUE }),
      });
      mp.x = 140;
      mp.y = 62 + i * 32;
      this.container.addChild(mp);
    });

    this.drawCursor(16, 66 + this.casterCursor * 32);
    this.drawHint('Aボタン: えらぶ  Bボタン: もどる');
  }

  private drawSpellSelect(): void {
    this.container.removeChildren();
    this.phase = 'spell';
    if (!this.caster) return;

    const titleWin = new Window(8, 8, GAME_WIDTH - 16, 36);
    this.container.addChild(titleWin);
    const title = new Text({
      text: `${this.caster.name}の じゅもん`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    title.x = 20;
    title.y = 18;
    this.container.addChild(title);

    const listWin = new Window(8, 52, GAME_WIDTH - 16, this.casterSpells.length * 28 + 16);
    this.container.addChild(listWin);

    this.casterSpells.forEach((spell, i) => {
      const usable = this.caster!.mp >= spell.mpCost;
      const style = new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        fill: usable ? COLORS.TEXT : COLORS.TEXT_DISABLED,
      });
      const text = new Text({ text: spell.name, style });
      text.x = 36;
      text.y = 62 + i * 28;
      this.container.addChild(text);

      const cost = new Text({
        text: `MP${spell.mpCost}`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: usable ? COLORS.MP_BLUE : COLORS.TEXT_DISABLED }),
      });
      cost.x = GAME_WIDTH - 70;
      cost.y = 62 + i * 28;
      this.container.addChild(cost);
    });

    this.drawCursor(16, 66 + this.spellCursor * 28);
    this.drawHint('Aボタン: つかう  Bボタン: もどる');
  }

  private drawTargetSelect(): void {
    this.container.removeChildren();
    this.phase = 'target';

    const members = this.game.state.active;
    const spellName = this.selectedSpell?.name ?? '';

    const nameWin = new Window(8, 8, GAME_WIDTH - 16, 36);
    this.container.addChild(nameWin);
    const nameText = new Text({
      text: `${spellName}を だれに つかう？`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    nameText.x = 20;
    nameText.y = 18;
    this.container.addChild(nameText);

    const listWin = new Window(8, 52, GAME_WIDTH - 16, members.length * 32 + 16);
    this.container.addChild(listWin);

    members.forEach((m, i) => {
      const hpColor = m.hp <= 0 ? COLORS.HP_RED : m.hp < m.maxHp * 0.3 ? COLORS.HP_YELLOW : COLORS.HP_GREEN;
      const text = new Text({
        text: m.name,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
      });
      text.x = 36;
      text.y = 62 + i * 32;
      this.container.addChild(text);

      const hp = new Text({
        text: `HP ${m.hp}/${m.maxHp}`,
        style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: hpColor }),
      });
      hp.x = 140;
      hp.y = 62 + i * 32;
      this.container.addChild(hp);
    });

    this.drawCursor(16, 66 + this.targetCursor * 32);
    this.drawHint('Bボタン: もどる');
  }

  private showMessage(msg: string): void {
    this.phase = 'message';
    this.messageTimer = 60; // 約1秒

    this.container.removeChildren();
    const win = new Window(8, GAME_HEIGHT / 2 - 30, GAME_WIDTH - 16, 60);
    this.container.addChild(win);

    const text = new Text({
      text: msg,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    text.x = 20;
    text.y = GAME_HEIGHT / 2 - 16;
    this.container.addChild(text);
  }

  private castSpell(target: PartyMember): string {
    const caster = this.caster!;
    const spell = this.selectedSpell!;

    if (caster.mp < spell.mpCost) {
      return 'MPが たりない！';
    }

    if (spell.type === 'heal') {
      if (target.hp <= 0) {
        return `${target.name}は しんでいる！`;
      }
      if (target.hp >= target.maxHp) {
        return `${target.name}の HPは まんたんだ！`;
      }
      caster.mp -= spell.mpCost;
      const healAmount = Math.min(spell.power, target.maxHp - target.hp);
      target.hp += healAmount;
      this.game.audio.playSeOrSynth('heal');
      return `${target.name}の HPが ${healAmount} かいふくした！`;
    }

    return 'ここでは つかえない！';
  }

  update(delta: number): void {
    const input = this.game.input;
    input.update();

    if (this.phase === 'message') {
      this.messageTimer -= delta;
      if (this.messageTimer <= 0 || input.isActionPressed) {
        const back = this.backDraw;
        this.backDraw = null;
        if (back) {
          back();
        } else {
          this.drawTargetSelect();
        }
      }
      input.resetOneShot();
      return;
    }

    const dir = input.directionJustPressed;

    if (this.phase === 'caster') {
      const members = this.game.state.active;
      if (dir === 'up' && this.casterCursor > 0) {
        this.casterCursor--;
        this.cursorText.y = 66 + this.casterCursor * 32;
      } else if (dir === 'down' && this.casterCursor < members.length - 1) {
        this.casterCursor++;
        this.cursorText.y = 66 + this.casterCursor * 32;
      }

      if (input.isActionPressed) {
        const member = members[this.casterCursor];
        const spells = this.getFieldSpells(member);
        if (spells.length === 0) {
          this.game.audio.playSeOrSynth('cancel');
          this.showMessageThenBack('じゅもんを おぼえていない。', () => this.drawCasterSelect());
        } else {
          this.game.audio.playSeOrSynth('confirm');
          this.caster = member;
          this.casterSpells = spells;
          this.spellCursor = 0;
          this.drawSpellSelect();
        }
      }

      if (input.isCancelPressed) {
        this.onClose();
      }

      input.resetOneShot();
      return;
    }

    if (this.phase === 'spell') {
      if (dir === 'up' && this.spellCursor > 0) {
        this.spellCursor--;
        this.cursorText.y = 66 + this.spellCursor * 28;
      } else if (dir === 'down' && this.spellCursor < this.casterSpells.length - 1) {
        this.spellCursor++;
        this.cursorText.y = 66 + this.spellCursor * 28;
      }

      if (input.isActionPressed) {
        const spell = this.casterSpells[this.spellCursor];
        if (this.caster && this.caster.mp < spell.mpCost) {
          this.game.audio.playSeOrSynth('cancel');
          this.showMessageThenBack('MPが たりない！', () => this.drawSpellSelect());
        } else {
          this.game.audio.playSeOrSynth('confirm');
          this.selectedSpell = spell;
          this.targetCursor = 0;
          this.drawTargetSelect();
        }
      }

      if (input.isCancelPressed) {
        this.drawCasterSelect();
      }

      input.resetOneShot();
      return;
    }

    // target phase
    const members = this.game.state.active;
    if (dir === 'up' && this.targetCursor > 0) {
      this.targetCursor--;
      this.cursorText.y = 66 + this.targetCursor * 32;
    } else if (dir === 'down' && this.targetCursor < members.length - 1) {
      this.targetCursor++;
      this.cursorText.y = 66 + this.targetCursor * 32;
    }

    if (input.isActionPressed && this.selectedSpell) {
      const msg = this.castSpell(members[this.targetCursor]);
      this.showMessage(msg);
    }

    if (input.isCancelPressed) {
      this.drawSpellSelect();
    }

    input.resetOneShot();
  }

  /** 一時メッセージを表示して指定画面に戻る */
  private backDraw: (() => void) | null = null;

  private showMessageThenBack(msg: string, back: () => void): void {
    this.backDraw = back;
    this.showMessage(msg);
  }
}

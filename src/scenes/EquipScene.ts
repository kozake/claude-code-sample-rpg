import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';
import type { PartyMember } from '../data/types';

const SLOT_LABELS: Record<string, string> = {
  weapon: 'ぶき',
  armor: 'よろい',
  shield: 'たて',
  accessory: 'アクセサリー',
};

/**
 * 装備画面
 * - メンバー選択 → 装備スロット表示
 */
export class EquipScene extends Scene {
  private cursorIndex = 0;
  private cursorText!: Text;
  private phase: 'member' | 'slot' = 'member';
  private selectedMember: PartyMember | null = null;
  private members: PartyMember[];
  private onClose: () => void;

  constructor(game: Game, onClose: () => void) {
    super(game);
    this.members = game.state.active;
    this.onClose = onClose;
  }

  onEnter(): void {
    this.drawMemberSelect();
  }

  private drawMemberSelect(): void {
    this.container.removeChildren();
    this.phase = 'member';
    this.cursorIndex = 0;

    const win = new Window(8, 8, GAME_WIDTH - 16, this.members.length * 32 + 16);
    this.container.addChild(win);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fill: COLORS.TEXT });

    this.members.forEach((m, i) => {
      const text = new Text({ text: `${m.name}  Lv.${m.level}`, style });
      text.x = 36;
      text.y = 18 + i * 32;
      this.container.addChild(text);
    });

    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.CURSOR }),
    });
    this.updateCursor();
    this.container.addChild(this.cursorText);

    this.addHint();
  }

  private drawEquipSlots(): void {
    if (!this.selectedMember) return;
    this.container.removeChildren();
    this.phase = 'slot';
    this.cursorIndex = 0;

    const m = this.selectedMember;

    // 名前ウィンドウ
    const nameWin = new Window(8, 8, GAME_WIDTH - 16, 36);
    this.container.addChild(nameWin);

    const nameText = new Text({
      text: `${m.name}のそうび`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 14, fill: COLORS.TEXT }),
    });
    nameText.x = 20;
    nameText.y = 18;
    this.container.addChild(nameText);

    // 装備スロット
    const slots = Object.entries(m.equipment) as [string, string | null][];
    const slotWin = new Window(8, 52, GAME_WIDTH - 16, slots.length * 36 + 16);
    this.container.addChild(slotWin);

    const labelStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.TEXT_DISABLED });
    const valStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });

    slots.forEach(([slot, equipped], i) => {
      const y = 62 + i * 36;
      const label = new Text({ text: SLOT_LABELS[slot] ?? slot, style: labelStyle });
      label.x = 36;
      label.y = y;
      this.container.addChild(label);

      const val = new Text({
        text: equipped ?? 'なし',
        style: equipped ? valStyle : labelStyle,
      });
      val.x = 120;
      val.y = y;
      this.container.addChild(val);
    });

    // ステータスサマリー
    const statWin = new Window(8, 62 + slots.length * 36 + 16, GAME_WIDTH - 16, 80);
    this.container.addChild(statWin);

    const statStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.TEXT });
    const statY = 62 + slots.length * 36 + 26;
    const statText = new Text({
      text: `こうげき力: ${m.attack}\nしゅび力:   ${m.defense}\nすばやさ:   ${m.speed}`,
      style: statStyle,
    });
    statText.x = 20;
    statText.y = statY;
    this.container.addChild(statText);

    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.CURSOR }),
    });
    this.updateCursor();
    this.container.addChild(this.cursorText);

    this.addHint();
  }

  private addHint(): void {
    const hint = new Text({
      text: 'Bボタン: もどる',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 10, fill: COLORS.TEXT_DISABLED }),
    });
    hint.anchor.set(0.5);
    hint.x = GAME_WIDTH / 2;
    hint.y = GAME_HEIGHT - 24;
    this.container.addChild(hint);
  }

  private updateCursor(): void {
    if (this.phase === 'member') {
      this.cursorText.x = 16;
      this.cursorText.y = 22 + this.cursorIndex * 32;
    } else {
      this.cursorText.x = 16;
      this.cursorText.y = 66 + this.cursorIndex * 36;
    }
  }

  private getMaxIndex(): number {
    if (this.phase === 'member') return this.members.length - 1;
    return 3; // 4 equipment slots
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    const max = this.getMaxIndex();

    if (input.direction === 'up' && this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateCursor();
    } else if (input.direction === 'down' && this.cursorIndex < max) {
      this.cursorIndex++;
      this.updateCursor();
    }

    if (input.isActionPressed) {
      if (this.phase === 'member') {
        this.selectedMember = this.members[this.cursorIndex];
        this.drawEquipSlots();
      }
      // TODO: Phase 4以降で装備変更ロジック
    }

    if (input.isCancelPressed) {
      if (this.phase === 'slot') {
        this.drawMemberSelect();
      } else {
        this.onClose();
      }
    }

    input.resetOneShot();
  }
}

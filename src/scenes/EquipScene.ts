import { Text, TextStyle } from 'pixi.js';
import { Scene } from '../core/Scene';
import { Window } from '../ui/Window';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import type { Game } from '../Game';
import type { PartyMember, ItemData } from '../data/types';

const SLOT_LABELS: Record<string, string> = {
  weapon: 'ぶき',
  armor: 'よろい',
  shield: 'たて',
  accessory: 'アクセサリー',
};

const SLOT_KEYS = ['weapon', 'armor', 'shield', 'accessory'] as const;

/**
 * 装備画面
 * - メンバー選択 → 装備スロット表示 → アイテム選択で装備変更
 */
export class EquipScene extends Scene {
  private cursorIndex = 0;
  private cursorText!: Text;
  private phase: 'member' | 'slot' | 'itemSelect' = 'member';
  private selectedMember: PartyMember | null = null;
  private selectedSlotKey: string = '';
  private members: PartyMember[];
  private onClose: () => void;
  private itemDataMap: Map<string, ItemData> = new Map();
  private equipCandidates: ItemData[] = [];
  private itemCursor = 0;

  constructor(game: Game, onClose: () => void) {
    super(game);
    this.members = game.state.active;
    this.onClose = onClose;
  }

  async onEnter(): Promise<void> {
    // アイテムマスタ読み込み
    const allItems = await this.game.content.loadJson<ItemData[]>('items/items.json');
    if (allItems) {
      for (const item of allItems) {
        this.itemDataMap.set(item.id, item);
      }
    }
    this.drawMemberSelect();
  }

  private getItemName(id: string | null): string {
    if (!id) return 'なし';
    return this.itemDataMap.get(id)?.name ?? id;
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

      const equipName = this.getItemName(equipped);
      const val = new Text({
        text: equipName,
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

  private drawItemSelect(): void {
    this.container.removeChildren();
    this.phase = 'itemSelect';
    this.itemCursor = 0;

    const slotLabel = SLOT_LABELS[this.selectedSlotKey] ?? this.selectedSlotKey;

    // タイトル
    const titleWin = new Window(8, 8, GAME_WIDTH - 16, 36);
    this.container.addChild(titleWin);

    const titleText = new Text({
      text: `${slotLabel}を えらんでください`,
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT }),
    });
    titleText.x = 20;
    titleText.y = 18;
    this.container.addChild(titleText);

    // 装備候補を取得（インベントリからslotに合う装備品）
    this.equipCandidates = [];
    for (const invItem of this.game.state.items) {
      const data = this.itemDataMap.get(invItem.id);
      if (data && data.type === 'equipment' && data.equipType === this.selectedSlotKey) {
        this.equipCandidates.push(data);
      }
    }

    // 「はずす」オプションを含めた表示
    const totalOptions = this.equipCandidates.length + 1; // +1 for はずす
    const listWin = new Window(8, 52, GAME_WIDTH - 16, totalOptions * 28 + 16);
    this.container.addChild(listWin);

    const style = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT });
    const statStyle = new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.TEXT_DISABLED });

    this.equipCandidates.forEach((item, i) => {
      const text = new Text({ text: item.name, style });
      text.x = 36;
      text.y = 62 + i * 28;
      this.container.addChild(text);

      // ステータス変化のプレビュー
      const diff = this.getStatDiff(item);
      if (diff) {
        const diffText = new Text({ text: diff, style: statStyle });
        diffText.x = 180;
        diffText.y = 62 + i * 28;
        this.container.addChild(diffText);
      }
    });

    // はずすオプション
    const removeText = new Text({
      text: 'はずす',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT_DISABLED }),
    });
    removeText.x = 36;
    removeText.y = 62 + this.equipCandidates.length * 28;
    this.container.addChild(removeText);

    // カーソル
    this.cursorText = new Text({
      text: '▶',
      style: new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 12, fill: COLORS.CURSOR }),
    });
    this.cursorText.x = 16;
    this.cursorText.y = 66;
    this.container.addChild(this.cursorText);

    this.addHint();
  }

  private getStatDiff(newItem: ItemData): string | null {
    if (!this.selectedMember || !newItem.equipStats) return null;

    const currentEquipId = this.selectedMember.equipment[this.selectedSlotKey as keyof typeof this.selectedMember.equipment];
    const currentItem = currentEquipId ? this.itemDataMap.get(currentEquipId) : null;
    const currentStats = currentItem?.equipStats ?? {};
    const newStats = newItem.equipStats;

    const parts: string[] = [];
    const atkDiff = (newStats.attack ?? 0) - (currentStats.attack ?? 0);
    const defDiff = (newStats.defense ?? 0) - (currentStats.defense ?? 0);
    const spdDiff = (newStats.speed ?? 0) - (currentStats.speed ?? 0);

    if (atkDiff !== 0) parts.push(`攻${atkDiff > 0 ? '+' : ''}${atkDiff}`);
    if (defDiff !== 0) parts.push(`守${defDiff > 0 ? '+' : ''}${defDiff}`);
    if (spdDiff !== 0) parts.push(`速${spdDiff > 0 ? '+' : ''}${spdDiff}`);

    return parts.length > 0 ? parts.join(' ') : null;
  }

  private equipItem(member: PartyMember, slotKey: string, newItem: ItemData | null): void {
    const currentEquipId = member.equipment[slotKey as keyof typeof member.equipment];

    // 現在の装備を外す（ステータス減算 + インベントリに戻す）
    if (currentEquipId) {
      const currentData = this.itemDataMap.get(currentEquipId);
      if (currentData?.equipStats) {
        member.attack -= currentData.equipStats.attack ?? 0;
        member.defense -= currentData.equipStats.defense ?? 0;
        member.speed -= currentData.equipStats.speed ?? 0;
      }
      this.game.state.addItem(currentEquipId);
    }

    // 新しい装備をセット
    if (newItem) {
      (member.equipment as Record<string, string | null>)[slotKey] = newItem.id;
      if (newItem.equipStats) {
        member.attack += newItem.equipStats.attack ?? 0;
        member.defense += newItem.equipStats.defense ?? 0;
        member.speed += newItem.equipStats.speed ?? 0;
      }
      this.game.state.useItem(newItem.id);
    } else {
      (member.equipment as Record<string, string | null>)[slotKey] = null;
    }
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
    } else if (this.phase === 'slot') {
      this.cursorText.x = 16;
      this.cursorText.y = 66 + this.cursorIndex * 36;
    } else if (this.phase === 'itemSelect') {
      this.cursorText.x = 16;
      this.cursorText.y = 66 + this.itemCursor * 28;
    }
  }

  private getMaxIndex(): number {
    if (this.phase === 'member') return this.members.length - 1;
    if (this.phase === 'slot') return 3; // 4 equipment slots
    return this.equipCandidates.length; // candidates + はずす
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    const max = this.getMaxIndex();

    if (this.phase === 'itemSelect') {
      const dir = input.directionJustPressed;
      if (dir === 'up' && this.itemCursor > 0) {
        this.itemCursor--;
        this.updateCursor();
      } else if (dir === 'down' && this.itemCursor < max) {
        this.itemCursor++;
        this.updateCursor();
      }

      if (input.isActionPressed && this.selectedMember) {
        if (this.itemCursor < this.equipCandidates.length) {
          // 装備品を選択
          const item = this.equipCandidates[this.itemCursor];
          this.equipItem(this.selectedMember, this.selectedSlotKey, item);
        } else {
          // はずす
          this.equipItem(this.selectedMember, this.selectedSlotKey, null);
        }
        this.drawEquipSlots();
      }

      if (input.isCancelPressed) {
        this.drawEquipSlots();
      }

      input.resetOneShot();
      return;
    }

    const dir = input.directionJustPressed;
    if (dir === 'up' && this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateCursor();
    } else if (dir === 'down' && this.cursorIndex < max) {
      this.cursorIndex++;
      this.updateCursor();
    }

    if (input.isActionPressed) {
      if (this.phase === 'member') {
        this.selectedMember = this.members[this.cursorIndex];
        this.drawEquipSlots();
      } else if (this.phase === 'slot') {
        this.selectedSlotKey = SLOT_KEYS[this.cursorIndex];
        this.drawItemSelect();
      }
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

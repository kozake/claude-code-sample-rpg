import type { PartyMember, PartyData, ItemData, SaveData } from '../data/types';
import { MAX_PARTY, MAX_ITEM_SLOTS } from '../constants';

/**
 * ゲーム全体の状態管理
 * - パーティ（active / reserve / left）
 * - 所持品・ゴールド
 * - セーブデータからの復元
 */
export class GameState {
  active: PartyMember[] = [];
  reserve: PartyMember[] = [];
  left: PartyMember[] = [];
  gold = 0;
  items: { id: string; count: number }[] = [];
  playTime = 0;

  /** 初期パーティ設定 */
  initNewGame(members: PartyMember[]): void {
    this.active = members.filter((m) => m.joinedByDefault).slice(0, MAX_PARTY);
    this.reserve = [];
    this.left = [];
    this.gold = 0;
    this.items = [];
    this.playTime = 0;
  }

  /** セーブデータから復元 */
  loadFromSave(data: SaveData): void {
    this.active = data.party.active;
    this.reserve = data.party.reserve;
    this.left = data.party.left;
    this.gold = data.party.gold;
    this.items = [...data.party.items];
    this.playTime = data.playTime;
  }

  /** PartyData形式でエクスポート */
  toPartyData(): PartyData {
    return {
      active: this.active,
      reserve: this.reserve,
      left: this.left,
      gold: this.gold,
      items: [...this.items],
    };
  }

  /** パーティメンバー追加（activeに空きがあればactive、なければreserve） */
  addMember(member: PartyMember): void {
    if (this.active.length < MAX_PARTY) {
      this.active.push(member);
    } else {
      this.reserve.push(member);
    }
  }

  /** パーティから一時離脱（leftへ移動） */
  removeMember(memberId: string): PartyMember | null {
    let idx = this.active.findIndex((m) => m.id === memberId);
    if (idx >= 0) {
      const member = this.active.splice(idx, 1)[0];
      this.left.push(member);
      return member;
    }
    idx = this.reserve.findIndex((m) => m.id === memberId);
    if (idx >= 0) {
      const member = this.reserve.splice(idx, 1)[0];
      this.left.push(member);
      return member;
    }
    return null;
  }

  /** 離脱メンバーを復帰 */
  returnMember(memberId: string): boolean {
    const idx = this.left.findIndex((m) => m.id === memberId);
    if (idx < 0) return false;
    const member = this.left.splice(idx, 1)[0];
    this.addMember(member);
    return true;
  }

  /** activeとreserve間の入れ替え */
  swapMember(activeIdx: number, reserveIdx: number): void {
    if (activeIdx >= this.active.length || reserveIdx >= this.reserve.length) return;
    const a = this.active[activeIdx];
    const r = this.reserve[reserveIdx];
    if (a.storyLocked) return; // ストーリーロック中は入れ替え不可
    this.active[activeIdx] = r;
    this.reserve[reserveIdx] = a;
  }

  /** アイテム追加 */
  addItem(itemId: string, count: number = 1): boolean {
    const existing = this.items.find((i) => i.id === itemId);
    if (existing) {
      existing.count += count;
      return true;
    }
    if (this.items.length >= MAX_ITEM_SLOTS) return false;
    this.items.push({ id: itemId, count });
    return true;
  }

  /** アイテム消費 */
  useItem(itemId: string, count: number = 1): boolean {
    const existing = this.items.find((i) => i.id === itemId);
    if (!existing || existing.count < count) return false;
    existing.count -= count;
    if (existing.count <= 0) {
      this.items = this.items.filter((i) => i.id !== itemId);
    }
    return true;
  }

  /** アイテム所持数 */
  getItemCount(itemId: string): number {
    return this.items.find((i) => i.id === itemId)?.count ?? 0;
  }

  /** 全メンバー（active + reserve） */
  get allMembers(): PartyMember[] {
    return [...this.active, ...this.reserve];
  }
}

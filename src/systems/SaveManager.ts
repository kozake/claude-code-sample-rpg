import { SAVE_KEY_PREFIX, SAVE_DATA_VERSION, SAVE_SLOTS } from '../constants';
import type { SaveData, PartyData } from '../data/types';
import type { Game } from '../Game';

/**
 * セーブ/ロード管理
 * - 3スロット + オートセーブ（スロット0）
 * - localStorage使用
 */
export class SaveManager {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  /** セーブデータを保存 */
  save(slotId: number, party: PartyData, currentMap: string, playerX: number, playerY: number, playTime: number): boolean {
    try {
      const data: SaveData = {
        version: SAVE_DATA_VERSION,
        slotId,
        party,
        storyFlags: { ...this.game.storyFlags },
        currentChapter: 'prologue',
        currentMap,
        playerPosition: { x: playerX, y: playerY },
        visitedMaps: [],
        lastSavePoint: { map: currentMap, x: playerX, y: playerY },
        playTime,
        savedAt: new Date().toISOString(),
      };

      const key = `${SAVE_KEY_PREFIX}${slotId}`;
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch {
      console.error('Save failed');
      return false;
    }
  }

  /** セーブデータを読み込み */
  load(slotId: number): SaveData | null {
    try {
      const key = `${SAVE_KEY_PREFIX}${slotId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const data = JSON.parse(raw) as SaveData;
      if (data.version !== SAVE_DATA_VERSION) {
        console.warn(`Save version mismatch: ${data.version} !== ${SAVE_DATA_VERSION}`);
      }
      return data;
    } catch {
      return null;
    }
  }

  /** セーブデータを削除 */
  delete(slotId: number): void {
    const key = `${SAVE_KEY_PREFIX}${slotId}`;
    localStorage.removeItem(key);
  }

  /** 全スロットのサマリーを取得 */
  getSlotSummaries(): (SaveSlotSummary | null)[] {
    const summaries: (SaveSlotSummary | null)[] = [];
    for (let i = 1; i <= SAVE_SLOTS; i++) {
      const data = this.load(i);
      if (data) {
        summaries.push({
          slotId: i,
          heroName: data.party.active[0]?.name ?? '???',
          level: data.party.active[0]?.level ?? 1,
          playTime: data.playTime,
          savedAt: data.savedAt,
          currentMap: data.currentMap,
        });
      } else {
        summaries.push(null);
      }
    }
    return summaries;
  }

  /** オートセーブ */
  autoSave(party: PartyData, currentMap: string, playerX: number, playerY: number, playTime: number): void {
    this.save(0, party, currentMap, playerX, playerY, playTime);
  }
}

export interface SaveSlotSummary {
  slotId: number;
  heroName: string;
  level: number;
  playTime: number;
  savedAt: string;
  currentMap: string;
}

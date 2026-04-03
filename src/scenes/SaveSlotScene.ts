import { Graphics, Text } from 'pixi.js';
import { Scene } from '../core/Scene';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONT_FAMILY } from '../constants';
import { SaveManager, type SaveSlotSummary } from '../systems/SaveManager';
import type { Game } from '../Game';

type SaveSlotMode = 'save' | 'load' | 'delete';

/**
 * セーブスロット選択画面
 * - セーブ/ロード/削除の3モード
 */
export class SaveSlotScene extends Scene {
  private saveManager: SaveManager;
  private mode: SaveSlotMode;
  private cursorIndex = 0;
  private slotSummaries: (SaveSlotSummary | null)[] = [];
  private cursorGraphic!: Text;
  private onSelect?: (slotId: number) => void;
  private onCancel?: () => void;

  constructor(game: Game, mode: SaveSlotMode, onSelect?: (slotId: number) => void, onCancel?: () => void) {
    super(game);
    this.saveManager = new SaveManager(game);
    this.mode = mode;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
  }

  onEnter(): void {
    this.slotSummaries = this.saveManager.getSlotSummaries();
    this.draw();
  }

  private draw(): void {
    this.container.removeChildren();

    // 背景
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(COLORS.BLACK);
    this.container.addChild(bg);

    // タイトル
    const modeLabels: Record<SaveSlotMode, string> = {
      save: 'ぼうけんのしょに きろくする',
      load: 'ぼうけんのしょを よみこむ',
      delete: 'ぼうけんのしょを けす',
    };

    const title = new Text({
      text: modeLabels[this.mode],
      style: { fontFamily: FONT_FAMILY, fontSize: 16, fill: COLORS.TEXT },
    });
    title.x = GAME_WIDTH / 2;
    title.y = 40;
    title.anchor.set(0.5, 0);
    this.container.addChild(title);

    // スロット表示
    for (let i = 0; i < 3; i++) {
      this.drawSlot(i, 80 + i * 120);
    }

    // カーソル
    this.cursorGraphic = new Text({
      text: '▶',
      style: { fontFamily: FONT_FAMILY, fontSize: 14, fill: COLORS.CURSOR },
    });
    this.updateCursorPosition();
    this.container.addChild(this.cursorGraphic);

    // 戻るヒント
    const hint = new Text({
      text: 'Bボタン: もどる',
      style: { fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.TEXT_DISABLED },
    });
    hint.x = GAME_WIDTH / 2;
    hint.y = GAME_HEIGHT - 40;
    hint.anchor.set(0.5);
    this.container.addChild(hint);
  }

  private drawSlot(index: number, y: number): void {
    const summary = this.slotSummaries[index];
    const slotWidth = GAME_WIDTH - 60;

    // ウィンドウ
    const win = new Graphics();
    win.roundRect(30, y, slotWidth, 100, 4)
      .fill({ color: COLORS.WINDOW_BG, alpha: 0.9 });
    win.roundRect(30, y, slotWidth, 100, 4)
      .stroke({ color: COLORS.WINDOW_BORDER, width: 2 });
    this.container.addChild(win);

    const slotTitle = new Text({
      text: `ぼうけんのしょ ${index + 1}`,
      style: { fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT },
    });
    slotTitle.x = 50;
    slotTitle.y = y + 10;
    this.container.addChild(slotTitle);

    if (summary) {
      const info = new Text({
        text: `${summary.heroName}  Lv.${summary.level}`,
        style: { fontFamily: FONT_FAMILY, fontSize: 14, fill: COLORS.TEXT },
      });
      info.x = 50;
      info.y = y + 35;
      this.container.addChild(info);

      const time = formatPlayTime(summary.playTime);
      const details = new Text({
        text: `プレイ時間: ${time}`,
        style: { fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.TEXT_DISABLED },
      });
      details.x = 50;
      details.y = y + 60;
      this.container.addChild(details);

      const dateStr = new Date(summary.savedAt).toLocaleDateString('ja-JP');
      const dateText = new Text({
        text: dateStr,
        style: { fontFamily: FONT_FAMILY, fontSize: 11, fill: COLORS.TEXT_DISABLED },
      });
      dateText.x = 50;
      dateText.y = y + 78;
      this.container.addChild(dateText);
    } else {
      const empty = new Text({
        text: '--- データなし ---',
        style: { fontFamily: FONT_FAMILY, fontSize: 13, fill: COLORS.TEXT_DISABLED },
      });
      empty.x = 50;
      empty.y = y + 45;
      this.container.addChild(empty);
    }
  }

  private updateCursorPosition(): void {
    this.cursorGraphic.x = 16;
    this.cursorGraphic.y = 80 + this.cursorIndex * 120 + 40;
  }

  update(_delta: number): void {
    const input = this.game.input;
    input.update();

    if (input.direction === 'up' && this.cursorIndex > 0) {
      this.cursorIndex--;
      this.updateCursorPosition();
    } else if (input.direction === 'down' && this.cursorIndex < 2) {
      this.cursorIndex++;
      this.updateCursorPosition();
    }

    if (input.isActionPressed) {
      const slotId = this.cursorIndex + 1;
      this.onSelect?.(slotId);
    }

    if (input.isCancelPressed) {
      this.onCancel?.();
    }

    input.resetOneShot();
  }
}

function formatPlayTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

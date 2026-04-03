import { Scene } from '../core/Scene';
import { TileMap } from '../map/TileMap';
import { Camera } from '../map/Camera';
import { CollisionMap } from '../map/CollisionMap';
import { Player } from '../entities/Player';
import { DPad } from '../ui/DPad';
import { ActionButton } from '../ui/ActionButton';
import { MenuButton } from '../ui/MenuButton';
import { MessageWindow } from '../ui/MessageWindow';
import { TILE_SIZE } from '../constants';
import type { Game } from '../Game';
import type { MapData } from '../data/types';

/**
 * フィールドシーン
 * - マップ描画 + カメラ追従
 * - プレイヤー移動
 * - ワープ・イベント判定
 * - UIオーバーレイ
 */
export class FieldScene extends Scene {
  private tileMap = new TileMap();
  private camera = new Camera();
  private collision = new CollisionMap();
  private player!: Player;
  private dpad!: DPad;
  private actionBtn!: ActionButton;
  private menuBtn!: MenuButton;
  private messageWindow = new MessageWindow();

  private mapData: MapData | null = null;
  private mapId: string;
  private startX?: number;
  private startY?: number;

  constructor(game: Game, mapId: string, startX?: number, startY?: number) {
    super(game);
    this.mapId = mapId;
    this.startX = startX;
    this.startY = startY;
  }

  async onEnter(): Promise<void> {
    // マップデータ読み込み
    this.mapData = await this.game.content.loadJson<MapData>(`maps/${this.mapId}.json`);
    if (!this.mapData) {
      console.error(`Map not found: ${this.mapId}`);
      return;
    }

    // マップ初期化
    this.tileMap.load(this.mapData);
    this.collision.load(this.mapData);
    this.camera.setMapSize(this.tileMap.widthPx, this.tileMap.heightPx);

    // プレイヤー初期化
    const px = this.startX ?? this.mapData.playerStart.x;
    const py = this.startY ?? this.mapData.playerStart.y;
    this.player = new Player(px, py);

    // マップコンテナにタイルマップとプレイヤーを追加
    this.container.addChild(this.tileMap.container);
    this.tileMap.container.addChild(this.player.container);

    // カメラ初期位置
    this.camera.follow(this.player.centerX, this.player.centerY);
    this.camera.applyTo(this.tileMap.container);

    // UIオーバーレイ（カメラの影響を受けない）
    this.dpad = new DPad(this.game.input);
    this.actionBtn = new ActionButton(this.game.input);
    this.menuBtn = new MenuButton(this.game.input);

    this.container.addChild(this.dpad.container);
    this.container.addChild(this.actionBtn.container);
    this.container.addChild(this.menuBtn.container);
    this.container.addChild(this.messageWindow.container);
  }

  update(delta: number): void {
    const input = this.game.input;
    input.update();

    // メッセージ表示中は移動不可
    if (this.messageWindow.isVisible) {
      this.messageWindow.update(delta);
      if (input.isActionPressed) {
        this.messageWindow.advance();
      }
      input.resetOneShot();
      return;
    }

    // プレイヤー移動
    this.player.handleInput(input, this.collision);
    this.player.update(delta);

    // 移動完了時のイベントチェック
    if (!this.player.isMoving) {
      this.checkWarps();
      this.checkEvents();
    }

    // 決定ボタンでNPC/前方チェック
    if (input.isActionPressed) {
      this.checkInteraction();
    }

    // カメラ追従
    this.camera.follow(this.player.centerX, this.player.centerY);
    this.camera.applyTo(this.tileMap.container);

    input.resetOneShot();
  }

  private checkWarps(): void {
    if (!this.mapData?.warps) return;

    for (const warp of this.mapData.warps) {
      if (this.player.tileX === warp.x && this.player.tileY === warp.y) {
        const newScene = new FieldScene(this.game, warp.toMap, warp.toX, warp.toY);
        this.game.scenes.switchTo(newScene);
        return;
      }
    }
  }

  private checkEvents(): void {
    if (!this.mapData?.events) return;

    for (const event of this.mapData.events) {
      if (this.player.tileX !== event.x || this.player.tileY !== event.y) continue;

      // onceFlag チェック
      if (event.onceFlag && this.game.storyFlags[event.onceFlag]) continue;

      // メッセージ表示
      if (event.action.message) {
        this.messageWindow.show(event.action.message, () => {
          if (event.onceFlag) {
            this.game.storyFlags[event.onceFlag!] = true;
          }
        });
      }
    }
  }

  private checkInteraction(): void {
    // 前方1タイルのNPCをチェック
    const dirOffset = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };
    const offset = dirOffset[this.player.direction];
    const checkX = this.player.tileX + offset.dx;
    const checkY = this.player.tileY + offset.dy;

    if (!this.mapData?.npcs) return;

    for (const npc of this.mapData.npcs) {
      if (npc.x === checkX && npc.y === checkY) {
        // TODO: NPCデータ読み込み＆会話表示（Phase 4）
        this.messageWindow.show([`${npc.id}に はなしかけた！`, 'まだ かいわデータが ありません。']);
        return;
      }
    }
  }

  onExit(): void {
    super.onExit();
  }
}

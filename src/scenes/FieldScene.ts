import { Container } from 'pixi.js';
import { Scene } from '../core/Scene';
import { TileMap } from '../map/TileMap';
import { Camera } from '../map/Camera';
import { CollisionMap } from '../map/CollisionMap';
import { Player } from '../entities/Player';
import { DPad } from '../ui/DPad';
import { ActionButton } from '../ui/ActionButton';
import { MenuButton } from '../ui/MenuButton';
import { MessageWindow } from '../ui/MessageWindow';
import { MenuScene } from './MenuScene';
import { StatusScene } from './StatusScene';
import { ItemScene } from './ItemScene';
import { EquipScene } from './EquipScene';
import { BattleScene } from './BattleScene';
import { ShopScene } from './ShopScene';
import { InnScene } from './InnScene';
import { ChurchScene } from './ChurchScene';
import { ChoiceWindow } from '../ui/ChoiceWindow';
import { DialogueManager } from '../systems/DialogueManager';
import type { Game } from '../Game';
import type { MapData, EnemyData, EnemyGroupData, NPCData } from '../data/types';

/**
 * フィールドシーン
 * - マップ描画 + カメラ追従
 * - プレイヤー移動
 * - ワープ・イベント判定
 * - メニューオーバーレイ
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

  /** メニュー等のオーバーレイ用 */
  private overlayContainer = new Container();
  private overlayScene: Scene | null = null;

  private mapData: MapData | null = null;
  private mapId: string;
  private startX?: number;
  private startY?: number;
  private lastStepCount = 0;
  private enemyDataCache: EnemyData[] | null = null;
  private groupDataCache: EnemyGroupData[] | null = null;
  private npcDataCache: Map<string, NPCData> = new Map();
  private dialogueManager!: DialogueManager;
  private choiceWindow = new ChoiceWindow();

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

    // DialogueManager初期化
    this.dialogueManager = new DialogueManager(this.game);

    // NPCデータ読み込み
    await this.loadNpcData();

    // UIオーバーレイ（カメラの影響を受けない）
    this.dpad = new DPad(this.game.input);
    this.actionBtn = new ActionButton(this.game.input);
    this.menuBtn = new MenuButton(this.game.input);

    this.container.addChild(this.dpad.container);
    this.container.addChild(this.actionBtn.container);
    this.container.addChild(this.menuBtn.container);
    this.container.addChild(this.messageWindow.container);
    this.container.addChild(this.choiceWindow.container);
    this.container.addChild(this.overlayContainer);
  }

  private async loadNpcData(): Promise<void> {
    // マップ上のNPC IDからNPCデータファイルを探す
    if (!this.mapData?.npcs || this.mapData.npcs.length === 0) return;

    // village_npcs.json等を読み込み（マップIDに基づいて推測、または全NPC統合ファイル）
    const npcFiles = [`npcs/${this.mapId}_npcs.json`, 'npcs/village_npcs.json'];
    for (const file of npcFiles) {
      const data = await this.game.content.loadJson<NPCData[]>(file);
      if (data) {
        for (const npc of data) {
          this.npcDataCache.set(npc.id, npc);
        }
      }
    }
  }

  update(delta: number): void {
    const input = this.game.input;
    input.update();

    // オーバーレイ（メニュー等）が開いている場合
    if (this.overlayScene) {
      this.overlayScene.update(delta);
      input.resetOneShot();
      return;
    }

    // 選択肢表示中
    if (this.choiceWindow.isVisible) {
      this.choiceWindow.handleInput(input.direction, input.isActionPressed);
      input.resetOneShot();
      return;
    }

    // メッセージ表示中は移動不可
    if (this.messageWindow.isVisible) {
      this.messageWindow.update(delta);
      if (input.isActionPressed) {
        this.messageWindow.advance();
      }
      input.resetOneShot();
      return;
    }

    // メニューボタン
    if (input.isMenuPressed) {
      this.openMenu();
      input.resetOneShot();
      return;
    }

    // プレイヤー移動
    this.player.handleInput(input, this.collision);
    this.player.update(delta);

    // 移動完了時のイベントチェック
    if (!this.player.isMoving) {
      // エンカウント判定（歩数が増えた時のみ）
      if (this.player.stepCount > this.lastStepCount) {
        this.lastStepCount = this.player.stepCount;
        if (this.checkEncounter()) {
          input.resetOneShot();
          return;
        }
      }
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

  private openMenu(): void {
    const menuScene = new MenuScene(
      this.game,
      () => this.closeOverlay(),
      (cmd) => {
        switch (cmd) {
          case 'status':
            this.showOverlay(new StatusScene(this.game, () => this.openMenu()));
            break;
          case 'item':
            this.showOverlay(new ItemScene(this.game, () => this.openMenu()));
            break;
          case 'equip':
            this.showOverlay(new EquipScene(this.game, () => this.openMenu()));
            break;
          default:
            // じゅもん/ならびかえ/さくせんは後のPhaseで実装
            break;
        }
      }
    );
    this.showOverlay(menuScene);
  }

  private showOverlay(scene: Scene): void {
    this.closeOverlay();
    this.overlayScene = scene;
    this.overlayContainer.addChild(scene.container);
    scene.onEnter();
  }

  private closeOverlay(): void {
    if (this.overlayScene) {
      this.overlayScene.onExit();
      this.overlayContainer.removeChildren();
      this.overlayScene = null;
    }
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

      // アイテム取得
      if (event.action.giveItem) {
        this.game.state.addItem(event.action.giveItem.id, event.action.giveItem.count);
      }

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

    for (const npcRef of this.mapData.npcs) {
      if (npcRef.x === checkX && npcRef.y === checkY) {
        const npcData = this.npcDataCache.get(npcRef.id);
        if (!npcData) {
          this.messageWindow.show([`${npcRef.id}に はなしかけた！`]);
          return;
        }
        this.interactWithNpc(npcData);
        return;
      }
    }
  }

  private interactWithNpc(npc: NPCData): void {
    const dialogue = this.dialogueManager.getCurrentDialogue(npc);
    if (!dialogue) {
      this.messageWindow.show([`${npc.name}は なにも いわなかった。`]);
      return;
    }

    // メッセージ表示 → 完了後にアクション実行
    this.messageWindow.show(dialogue.lines, () => {
      // フラグ・アイテム付与
      this.dialogueManager.executeDialogueActions(dialogue);

      // 選択肢がある場合
      if (dialogue.choices && dialogue.choices.length > 0) {
        const labels = dialogue.choices.map((c) => c.label);
        this.choiceWindow.show(labels, (idx) => {
          const choice = dialogue.choices![idx];
          this.dialogueManager.executeChoiceAction(choice);
          // 選択後のメッセージ
          if (choice.action.lines) {
            this.messageWindow.show(choice.action.lines, () => {
              this.handleNpcService(npc, choice);
            });
          } else {
            this.handleNpcService(npc, choice);
          }
          // repeatDialogue（「だが ことわる」パターン）
          if (choice.action.repeatDialogue) {
            setTimeout(() => this.interactWithNpc(npc), 100);
          }
        });
        return;
      }

      // ショップ/宿屋/教会
      this.handleNpcService(npc);
    });
  }

  private handleNpcService(npc: NPCData, _choice?: unknown): void {
    if (!npc.shopType) return;

    switch (npc.shopType) {
      case 'weapon':
      case 'armor':
      case 'item': {
        const shopItems = (npc.shopItems ?? []).map((id) => ({
          id,
          name: id, // TODO: アイテムマスタから名前を引く
          price: 10,
        }));
        this.showOverlay(new ShopScene(this.game, shopItems, () => this.closeOverlay()));
        break;
      }
      case 'inn': {
        this.showOverlay(new InnScene(this.game, npc.innPrice ?? 10, () => this.closeOverlay()));
        break;
      }
      case 'church': {
        this.showOverlay(
          new ChurchScene(this.game, () => this.closeOverlay(), this.mapId, this.player.tileX, this.player.tileY)
        );
        break;
      }
    }
  }

  /** ランダムエンカウント判定 */
  private checkEncounter(): boolean {
    if (!this.mapData?.encounterRate || !this.mapData.encounters) return false;

    // encounterRate歩に1回エンカウント（確率: 1/encounterRate）
    if (Math.random() * this.mapData.encounterRate >= 1) return false;

    // 重み付きランダムでグループ選択
    const encounters = this.mapData.encounters;
    const totalWeight = encounters.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedGroupId = encounters[0].groupId;
    for (const enc of encounters) {
      roll -= enc.weight;
      if (roll <= 0) {
        selectedGroupId = enc.groupId;
        break;
      }
    }

    this.startBattle(selectedGroupId);
    return true;
  }

  private async startBattle(groupId: string): Promise<void> {
    // 敵データの遅延読み込み
    if (!this.enemyDataCache) {
      this.enemyDataCache = await this.game.content.loadJson<EnemyData[]>('enemies/enemies.json') ?? [];
    }
    if (!this.groupDataCache) {
      this.groupDataCache = await this.game.content.loadJson<EnemyGroupData[]>('enemies/groups.json') ?? [];
    }

    const group = this.groupDataCache.find((g) => g.id === groupId);
    if (!group) return;

    // グループから敵リストを組み立て
    const enemies: EnemyData[] = [];
    for (const entry of group.enemies) {
      const data = this.enemyDataCache.find((e) => e.id === entry.enemyId);
      if (data) {
        for (let i = 0; i < entry.count; i++) {
          enemies.push({ ...data });
        }
      }
    }

    if (enemies.length === 0) return;

    const battleScene = new BattleScene(this.game, enemies, (victory) => {
      // 戦闘後: フィールドに戻る
      const field = new FieldScene(this.game, this.mapId, this.player.tileX, this.player.tileY);
      this.game.scenes.switchTo(field);
    });
    this.game.scenes.switchTo(battleScene);
  }

  onExit(): void {
    this.closeOverlay();
    super.onExit();
  }
}

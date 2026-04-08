import { Container, Graphics, Sprite, Texture, Rectangle, Assets } from 'pixi.js';
import { TILE_SIZE } from '../constants';
import type { MapData } from '../data/types';

const BASE = import.meta.env.BASE_URL;

/**
 * タイルマップ描画
 * - ground層とobjects層を描画
 * - タイルセット画像がある場合はそちらを使用、なければ色分けした矩形で代替表示
 */
export class TileMap {
  readonly container = new Container();
  private mapData: MapData | null = null;
  private tileTextures: Texture[] = [];

  /** タイルIDに応じた仮の色（テクスチャ導入まで） */
  private static TILE_COLORS: Record<number, number> = {
    0: 0x228b22, // 草原（緑）
    1: 0x8b6914, // 土（茶）
    2: 0x4169e1, // 水（青）
    3: 0x808080, // 石壁（灰）
    4: 0x654321, // 木の幹（焦げ茶）
    5: 0xdaa520, // 砂（黄土）
    6: 0x2f4f2f, // 森（暗緑）
    7: 0xffd700, // 特殊タイル（金）
    8: 0x1a0a00, // 洞窟入口（暗黒）
  };

  async load(mapData: MapData): Promise<void> {
    this.mapData = mapData;
    this.container.removeChildren();
    this.tileTextures = [];

    // タイルセット画像の読み込みを試みる
    if (mapData.tileset) {
      try {
        const url = `${BASE}assets/sprites/tilesets/${mapData.tileset}.png`;
        const tex: Texture = await Assets.load(url);

        const tilesPerRow = Math.floor(tex.width / TILE_SIZE);
        const totalTiles = tilesPerRow * Math.floor(tex.height / TILE_SIZE);

        for (let i = 0; i < totalTiles; i++) {
          const col = i % tilesPerRow;
          const row = Math.floor(i / tilesPerRow);
          const frame = new Texture({
            source: tex.source,
            frame: new Rectangle(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE),
          });
          this.tileTextures.push(frame);
        }
      } catch {
        // タイルセット画像なし：フォールバック
        this.tileTextures = [];
      }
    }

    this.drawLayer(mapData.layers.ground);
    this.drawLayer(mapData.layers.objects);
  }

  private drawLayer(layer: number[][]): void {
    if (this.tileTextures.length > 0) {
      // タイルセット画像で描画
      const layerContainer = new Container();
      for (let y = 0; y < layer.length; y++) {
        const row = layer[y];
        for (let x = 0; x < row.length; x++) {
          const tileId = row[x];
          if (tileId < 0) continue;
          const tex = this.tileTextures[tileId];
          if (!tex) continue;
          const sprite = new Sprite(tex);
          sprite.x = x * TILE_SIZE;
          sprite.y = y * TILE_SIZE;
          layerContainer.addChild(sprite);
        }
      }
      this.container.addChild(layerContainer);
    } else {
      // フォールバック：色付き矩形
      const g = new Graphics();
      for (let y = 0; y < layer.length; y++) {
        const row = layer[y];
        for (let x = 0; x < row.length; x++) {
          const tileId = row[x];
          if (tileId < 0) continue;
          const color = TileMap.TILE_COLORS[tileId] ?? 0x228b22;
          g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill(color);
        }
      }
      this.container.addChild(g);
    }
  }

  get widthPx(): number {
    return this.mapData ? this.mapData.width * TILE_SIZE : 0;
  }

  get heightPx(): number {
    return this.mapData ? this.mapData.height * TILE_SIZE : 0;
  }

  getData(): MapData | null {
    return this.mapData;
  }
}

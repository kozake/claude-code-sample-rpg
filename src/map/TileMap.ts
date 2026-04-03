import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from '../constants';
import type { MapData } from '../data/types';

/**
 * タイルマップ描画
 * - ground層とobjects層を描画
 * - テクスチャがない間は色分けした矩形で代替表示
 */
export class TileMap {
  readonly container = new Container();
  private mapData: MapData | null = null;

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
  };

  load(mapData: MapData): void {
    this.mapData = mapData;
    this.container.removeChildren();
    this.drawLayer(mapData.layers.ground);
    this.drawLayer(mapData.layers.objects);
  }

  private drawLayer(layer: number[][]): void {
    const g = new Graphics();
    for (let y = 0; y < layer.length; y++) {
      const row = layer[y];
      for (let x = 0; x < row.length; x++) {
        const tileId = row[x];
        if (tileId < 0) continue; // -1 = 透明
        const color = TileMap.TILE_COLORS[tileId] ?? 0x228b22;
        g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill(color);
      }
    }
    this.container.addChild(g);
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

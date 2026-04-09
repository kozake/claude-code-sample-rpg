import { Container, Graphics, Sprite, Texture, Rectangle, Assets } from 'pixi.js';
import { TILE_SIZE } from '../constants';
import type { MapData } from '../data/types';

const BASE = import.meta.env.BASE_URL;

/**
 * タイルマップ描画（リッチグラフィック版）
 * - タイルセット画像がある場合はそちらを使用
 * - フォールバック時はプロシージャル生成のリッチなタイルを描画
 */
export class TileMap {
  readonly container = new Container();
  private mapData: MapData | null = null;
  private tileTextures: Texture[] = [];

  /** シードベースの擬似乱数（タイル座標から一貫した値を生成） */
  private static hash(x: number, y: number, seed: number): number {
    let h = seed + x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  }

  async load(mapData: MapData): Promise<void> {
    this.mapData = mapData;
    this.container.removeChildren();
    this.tileTextures = [];

    // タイルセット画像の読み込みを試みる
    if (mapData.tileset) {
      try {
        const url = `${BASE}assets/sprites/tilesets/${mapData.tileset}.png`;
        const tex: Texture = await Assets.load(url);

        const srcSize = mapData.tileSize ?? 16;
        const tilesPerRow = Math.floor(tex.width / srcSize);
        const totalTiles = tilesPerRow * Math.floor(tex.height / srcSize);

        for (let i = 0; i < totalTiles; i++) {
          const col = i % tilesPerRow;
          const row = Math.floor(i / tilesPerRow);
          const frame = new Texture({
            source: tex.source,
            frame: new Rectangle(col * srcSize, row * srcSize, srcSize, srcSize),
          });
          this.tileTextures.push(frame);
        }
      } catch {
        this.tileTextures = [];
      }
    }

    this.drawLayer(mapData.layers.ground, false);
    this.drawLayer(mapData.layers.objects, true);
  }

  private drawLayer(layer: number[][], isObjectLayer: boolean): void {
    if (this.tileTextures.length > 0) {
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
          sprite.width = TILE_SIZE;
          sprite.height = TILE_SIZE;
          layerContainer.addChild(sprite);
        }
      }
      this.container.addChild(layerContainer);
    } else {
      // リッチなプロシージャルタイル描画
      const g = new Graphics();
      for (let y = 0; y < layer.length; y++) {
        const row = layer[y];
        for (let x = 0; x < row.length; x++) {
          const tileId = row[x];
          if (tileId < 0) continue;
          this.drawRichTile(g, x, y, tileId, isObjectLayer);
        }
      }
      this.container.addChild(g);
    }
  }

  /** タイルIDに応じたリッチなプロシージャル描画 */
  private drawRichTile(g: Graphics, tx: number, ty: number, tileId: number, isObject: boolean): void {
    const px = tx * TILE_SIZE;
    const py = ty * TILE_SIZE;
    const s = TILE_SIZE;
    const h = TileMap.hash;

    switch (tileId) {
      case 0: // 草原
        this.drawGrass(g, px, py, s, tx, ty);
        break;
      case 1: // 土
        this.drawDirt(g, px, py, s, tx, ty);
        break;
      case 2: // 水
        this.drawWater(g, px, py, s, tx, ty);
        break;
      case 3: // 石壁
        this.drawStoneWall(g, px, py, s, tx, ty, isObject);
        break;
      case 4: // 木
        this.drawTree(g, px, py, s, tx, ty);
        break;
      case 5: // 砂
        this.drawSand(g, px, py, s, tx, ty);
        break;
      case 6: // 森
        this.drawForest(g, px, py, s, tx, ty);
        break;
      case 7: // 屋根/特殊
        this.drawRoof(g, px, py, s, tx, ty, isObject);
        break;
      case 8: // 洞窟入口
        this.drawCaveEntrance(g, px, py, s, tx, ty);
        break;
      default: {
        g.rect(px, py, s, s).fill(0x228b22);
        break;
      }
    }
  }

  private drawGrass(g: Graphics, px: number, py: number, s: number, tx: number, ty: number): void {
    const h = TileMap.hash;
    // ベースカラー（少しバリエーション）
    const variation = h(tx, ty, 1);
    const baseR = Math.floor(0x1a + variation * 0x18);
    const baseG = Math.floor(0x78 + variation * 0x20);
    const baseB = Math.floor(0x18 + variation * 0x10);
    const baseColor = (baseR << 16) | (baseG << 8) | baseB;

    g.rect(px, py, s, s).fill(baseColor);

    // 草のディテール（明るい点）
    for (let i = 0; i < 6; i++) {
      const gx = px + h(tx + i, ty, 10) * (s - 4) + 2;
      const gy = py + h(tx, ty + i, 11) * (s - 4) + 2;
      const highlight = h(tx + i, ty + i, 12) > 0.5;
      const detailColor = highlight ? 0x40a838 : 0x1a6818;
      const detailSize = 1 + h(tx + i, ty, 13);
      g.rect(gx, gy, detailSize, detailSize).fill({ color: detailColor, alpha: 0.6 });
    }

    // 花（稀に）
    if (h(tx, ty, 20) > 0.85) {
      const flowerColors = [0xf8e840, 0xf87070, 0xf0f0f0, 0x80a0f0];
      const fc = flowerColors[Math.floor(h(tx, ty, 21) * flowerColors.length)];
      const fx = px + h(tx, ty, 22) * (s - 6) + 3;
      const fy = py + h(tx, ty, 23) * (s - 6) + 3;
      g.circle(fx, fy, 1.5).fill(fc);
    }
  }

  private drawDirt(g: Graphics, px: number, py: number, s: number, tx: number, ty: number): void {
    const h = TileMap.hash;
    const v = h(tx, ty, 1);
    const baseR = Math.floor(0x70 + v * 0x20);
    const baseG = Math.floor(0x50 + v * 0x18);
    const baseB = Math.floor(0x20 + v * 0x10);
    const baseColor = (baseR << 16) | (baseG << 8) | baseB;

    g.rect(px, py, s, s).fill(baseColor);

    // 小石
    for (let i = 0; i < 3; i++) {
      const sx = px + h(tx + i, ty, 30) * (s - 4) + 2;
      const sy = py + h(tx, ty + i, 31) * (s - 4) + 2;
      const sr = 1 + h(tx + i, ty + i, 32);
      g.circle(sx, sy, sr).fill({ color: 0x907858, alpha: 0.5 });
    }

    // 暗いスポット
    if (h(tx, ty, 33) > 0.6) {
      const dx = px + h(tx, ty, 34) * (s - 8) + 4;
      const dy = py + h(tx, ty, 35) * (s - 8) + 4;
      g.circle(dx, dy, 3).fill({ color: 0x503820, alpha: 0.3 });
    }
  }

  private drawWater(g: Graphics, px: number, py: number, s: number, tx: number, ty: number): void {
    const h = TileMap.hash;
    // 深い青のベース
    const v = h(tx, ty, 1);
    const baseR = Math.floor(0x20 + v * 0x10);
    const baseG = Math.floor(0x48 + v * 0x18);
    const baseB = Math.floor(0xa0 + v * 0x20);
    const baseColor = (baseR << 16) | (baseG << 8) | baseB;

    g.rect(px, py, s, s).fill(baseColor);

    // 波紋パターン
    for (let i = 0; i < 3; i++) {
      const wy = py + (s / 4) * (i + 0.5) + h(tx, ty + i, 40) * 4;
      const waveWidth = s * 0.6 + h(tx + i, ty, 41) * s * 0.3;
      const wx = px + (s - waveWidth) / 2;
      g.rect(wx, wy, waveWidth, 1).fill({ color: 0x70b0e8, alpha: 0.4 });
    }

    // ハイライト（光の反射）
    if (h(tx, ty, 45) > 0.6) {
      const hx = px + h(tx, ty, 46) * (s - 6) + 3;
      const hy = py + h(tx, ty, 47) * (s - 6) + 3;
      g.rect(hx, hy, 2, 1).fill({ color: 0xc0e0ff, alpha: 0.5 });
    }
  }

  private drawStoneWall(g: Graphics, px: number, py: number, s: number, tx: number, ty: number, isObject: boolean): void {
    const h = TileMap.hash;
    // 石壁ベース
    const v = h(tx, ty, 1);
    const base = isObject ? 0x787878 : 0x686868;
    const baseR = ((base >> 16) & 0xff) + Math.floor(v * 0x10);
    const baseG = ((base >> 8) & 0xff) + Math.floor(v * 0x10);
    const baseB = (base & 0xff) + Math.floor(v * 0x10);
    const baseColor = (baseR << 16) | (baseG << 8) | baseB;

    g.rect(px, py, s, s).fill(baseColor);

    // レンガ模様
    const brickH = Math.floor(s / 4);
    for (let row = 0; row < 4; row++) {
      const by = py + row * brickH;
      // 横線（モルタル）
      g.rect(px, by, s, 1).fill({ color: 0x505050, alpha: 0.5 });
      // 縦線（オフセット）
      const offset = row % 2 === 0 ? 0 : s / 2;
      g.rect(px + offset, by, 1, brickH).fill({ color: 0x505050, alpha: 0.4 });
      if (offset > 0) {
        g.rect(px, by, 1, brickH).fill({ color: 0x505050, alpha: 0.4 });
      }
    }

    // ハイライト（上端）
    g.rect(px, py, s, 1).fill({ color: 0xa0a0a0, alpha: 0.3 });
  }

  private drawTree(g: Graphics, px: number, py: number, s: number, tx: number, ty: number): void {
    const h = TileMap.hash;

    // 草地ベース
    g.rect(px, py, s, s).fill(0x208828);

    // 幹
    const trunkW = 6 + h(tx, ty, 50) * 2;
    const trunkX = px + (s - trunkW) / 2;
    g.rect(trunkX, py + s * 0.5, trunkW, s * 0.5).fill(0x604020);
    g.rect(trunkX + 1, py + s * 0.5, 1, s * 0.4).fill({ color: 0x806040, alpha: 0.5 });

    // 葉（重なった円形）
    const leafColor1 = 0x188020;
    const leafColor2 = 0x28a030;
    const cx = px + s / 2;
    g.circle(cx, py + s * 0.35, 10).fill(leafColor1);
    g.circle(cx - 4, py + s * 0.3, 7).fill(leafColor2);
    g.circle(cx + 4, py + s * 0.3, 7).fill(leafColor2);
    g.circle(cx, py + s * 0.2, 6).fill(leafColor1);

    // 葉のハイライト
    g.circle(cx - 2, py + s * 0.25, 3).fill({ color: 0x48c048, alpha: 0.5 });
  }

  private drawSand(g: Graphics, px: number, py: number, s: number, tx: number, ty: number): void {
    const h = TileMap.hash;
    const v = h(tx, ty, 1);
    const baseR = Math.floor(0xc0 + v * 0x20);
    const baseG = Math.floor(0xa0 + v * 0x18);
    const baseB = Math.floor(0x50 + v * 0x10);
    const baseColor = (baseR << 16) | (baseG << 8) | baseB;

    g.rect(px, py, s, s).fill(baseColor);

    // 砂粒テクスチャ
    for (let i = 0; i < 8; i++) {
      const sx = px + h(tx + i, ty, 60) * s;
      const sy = py + h(tx, ty + i, 61) * s;
      const bright = h(tx + i, ty + i, 62) > 0.5;
      g.rect(sx, sy, 1, 1).fill({ color: bright ? 0xe0c878 : 0xa08840, alpha: 0.4 });
    }

    // 風紋（稀に）
    if (h(tx, ty, 65) > 0.7) {
      const wy = py + h(tx, ty, 66) * (s - 4) + 2;
      g.rect(px + 4, wy, s - 8, 1).fill({ color: 0xa89050, alpha: 0.3 });
    }
  }

  private drawForest(g: Graphics, px: number, py: number, s: number, tx: number, ty: number): void {
    const h = TileMap.hash;

    // 暗い緑ベース
    const v = h(tx, ty, 1);
    const baseR = Math.floor(0x10 + v * 0x10);
    const baseG = Math.floor(0x38 + v * 0x18);
    const baseB = Math.floor(0x10 + v * 0x08);
    const baseColor = (baseR << 16) | (baseG << 8) | baseB;
    g.rect(px, py, s, s).fill(baseColor);

    // 密集した葉の重なり
    for (let i = 0; i < 4; i++) {
      const lx = px + h(tx + i, ty, 70) * (s - 8) + 4;
      const ly = py + h(tx, ty + i, 71) * (s - 8) + 4;
      const lr = 4 + h(tx + i, ty + i, 72) * 4;
      const shade = h(tx + i, ty, 73) > 0.5 ? 0x206828 : 0x185020;
      g.circle(lx, ly, lr).fill(shade);
    }

    // 木漏れ日
    if (h(tx, ty, 75) > 0.7) {
      const sx = px + h(tx, ty, 76) * (s - 4) + 2;
      const sy = py + h(tx, ty, 77) * (s - 4) + 2;
      g.circle(sx, sy, 2).fill({ color: 0x60c040, alpha: 0.4 });
    }
  }

  private drawRoof(g: Graphics, px: number, py: number, s: number, tx: number, ty: number, isObject: boolean): void {
    const h = TileMap.hash;

    if (isObject) {
      // 屋根タイル（赤茶色）
      const v = h(tx, ty, 1);
      const baseR = Math.floor(0x90 + v * 0x20);
      const baseG = Math.floor(0x40 + v * 0x10);
      const baseB = Math.floor(0x20 + v * 0x08);
      const baseColor = (baseR << 16) | (baseG << 8) | baseB;

      g.rect(px, py, s, s).fill(baseColor);

      // 瓦パターン
      const tileH = Math.floor(s / 3);
      for (let row = 0; row < 3; row++) {
        const ty2 = py + row * tileH;
        const offset = row % 2 === 0 ? 0 : s / 3;
        for (let col = 0; col < 3; col++) {
          const tx2 = px + col * (s / 3) + offset;
          // 瓦の下端に影
          g.rect(tx2, ty2 + tileH - 2, s / 3, 2).fill({ color: 0x000000, alpha: 0.15 });
          // 瓦の上端にハイライト
          g.rect(tx2, ty2, s / 3, 1).fill({ color: 0xffffff, alpha: 0.1 });
        }
      }
    } else {
      // 地面の金色タイル
      g.rect(px, py, s, s).fill(0xc0a030);
      g.rect(px, py, s, 1).fill({ color: 0xe0c860, alpha: 0.5 });
      g.rect(px, py + s - 1, s, 1).fill({ color: 0x806020, alpha: 0.5 });
    }
  }

  private drawCaveEntrance(g: Graphics, px: number, py: number, s: number, tx: number, ty: number): void {
    const h = TileMap.hash;

    // 暗い岩ベース
    g.rect(px, py, s, s).fill(0x282018);

    // 洞窟の奥行き感（中央が暗い）
    g.circle(px + s / 2, py + s / 2, s * 0.4).fill({ color: 0x080400, alpha: 0.6 });
    g.circle(px + s / 2, py + s / 2, s * 0.25).fill({ color: 0x000000, alpha: 0.8 });

    // 岩肌ディテール
    for (let i = 0; i < 4; i++) {
      const rx = px + h(tx + i, ty, 80) * s;
      const ry = py + h(tx, ty + i, 81) * s;
      const rs = 2 + h(tx + i, ty + i, 82) * 3;
      g.circle(rx, ry, rs).fill({ color: 0x383028, alpha: 0.4 });
    }

    // 入口の光の縁
    g.rect(px + 4, py, s - 8, 1).fill({ color: 0x505040, alpha: 0.5 });
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

import { Container } from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

/**
 * カメラ（ビューポート）
 * - プレイヤーを中心に追従
 * - マップ端でのクランプ
 */
export class Camera {
  x = 0;
  y = 0;

  private mapWidth = 0;
  private mapHeight = 0;

  setMapSize(widthPx: number, heightPx: number): void {
    this.mapWidth = widthPx;
    this.mapHeight = heightPx;
  }

  /** プレイヤー座標を中心にカメラ位置を更新 */
  follow(targetX: number, targetY: number): void {
    this.x = targetX - GAME_WIDTH / 2;
    this.y = targetY - GAME_HEIGHT / 2;
    this.clamp();
  }

  private clamp(): void {
    if (this.x < 0) this.x = 0;
    if (this.y < 0) this.y = 0;

    const maxX = this.mapWidth - GAME_WIDTH;
    const maxY = this.mapHeight - GAME_HEIGHT;

    if (maxX > 0 && this.x > maxX) this.x = maxX;
    if (maxY > 0 && this.y > maxY) this.y = maxY;

    // マップがビューポートより小さい場合は中央に
    if (this.mapWidth < GAME_WIDTH) this.x = -(GAME_WIDTH - this.mapWidth) / 2;
    if (this.mapHeight < GAME_HEIGHT) this.y = -(GAME_HEIGHT - this.mapHeight) / 2;
  }

  /** コンテナにカメラオフセットを適用 */
  applyTo(container: Container): void {
    container.x = -Math.round(this.x);
    container.y = -Math.round(this.y);
  }
}

export class AssetManager {
  private cache = new Map<string, unknown>();

  async loadTexture(_path: string): Promise<void> {
    // Phase 2 以降で実装: assets/ のスプライト・タイルセットをロード
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
}

# CLAUDE.md - プロジェクトガイド

## プロジェクト概要

ドラゴンクエスト風2D RPG。スマートフォンWebブラウザで動作。PixiJS v8 + TypeScript + Vite。

## ビルド・実行

```bash
npm install          # 依存インストール
npm run dev          # 開発サーバー (localhost:3000)
npm run build        # ビルド (docs/ に出力、GitHub Pages用)
npx tsc --noEmit     # 型チェックのみ
```

## ディレクトリ構成（3エリア分離）

- `src/` - **プログラマー領域** (TypeScript)
- `content/` - **シナリオライター領域** (JSON) - ゲームデータ全般
- `assets/` - **デザイナー領域** (画像/音声)
- `docs/` - ビルド成果物（GitHub Pages配信用、git管理対象）
- `public/` - content/ と assets/ へのシンボリックリンク（Viteビルド用）

## 重要な技術仕様

- **解像度**: 320×568px、CSS transformでスケーリング
- **タイルサイズ**: 32×32px（表示サイズ。元画像は16×16pxでスケーリング表示）
- **フォント**: DotGothic16 (Google Fonts CDN)
- **PixiJS v8**: `app.init()` は async、`preference: 'webgl'`
- **BASE_URL**: `import.meta.env.BASE_URL` で GitHub Pages のパス解決
- **ビルド出力**: `docs/` ディレクトリ（Viteが毎回クリーンして再生成）

## アーキテクチャ

### シーン管理
- `Scene` 基底クラス → `SceneManager.switchTo()` で切り替え
- FieldScene内のメニューは `overlayScene` パターン（シーン遷移せずオーバーレイ）

### データフロー
- `Game` がすべてのシステムを保持: `scenes`, `input`, `state`, `audio`, `levelUp`, `content`, `storyFlags`
- `ContentLoader` は `content/` 配下のJSONを遅延ロード
- `GameState` がパーティ(active/reserve/left)・アイテム・ゴールドを管理

### 戦闘
- DQ風ダメージ計算: `(attack/2) - (defense/4) ± 10%`
- クリティカル: 攻撃力×0.8（防御無視）
- 逃走: `50% + (味方速度 - 敵速度) × 2%`

### NPC会話
- `DialogueManager` が `StoryCondition` を評価して会話分岐
- shopType で自動的にショップ/宿屋/教会シーンに接続

## コーディング規約

- 日本語コメントを使用
- UIテキストはすべてひらがな（DQ風）
- 型定義は `src/data/types.ts` に集約
- 定数は `src/constants.ts` に集約
- 仮のグラフィック: Graphics矩形で色分け表示（テクスチャ導入までの代替）

## content/ JSON作成ルール

- マップ: `content/maps/{mapId}.json` - MapData型準拠
- NPC: `content/npcs/{mapId}_npcs.json` - NPCData[]型準拠
- 敵: `content/enemies/enemies.json` + `groups.json`
- アイテム: `content/items/items.json`
- カットシーン: `content/story/cutscenes/{id}.json`
- レベルテーブル: `content/data/level_tables.json`
- ストーリーフラグ参照: `content/story/flags.json`

## デプロイ

GitHub Pages: Settings → Pages → Branch: main, Folder: /docs
改修時は `npm run build` 後に docs/ をコミット＆プッシュ。

## 注意事項

- `tools/` は tsconfig.json の include から除外（Node型との競合回避、tsx で個別実行）
- `public/content` と `public/assets` はシンボリックリンク（実体は content/ と assets/）
- AudioManager はファイルが存在しなくても静かに失敗する設計（音声アセットは後から追加可能）

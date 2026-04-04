# UI Redesign Plan: Canvas-First Layout

## 概要

マンデルブロ集合ビューアのUIを「Canvas-First」コンセプトで一新。
固定2カラムグリッドレイアウトから、フローティングUI + パネルベースのレイアウトに移行した。

## 実装状況

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 1 | レイアウト基盤変更 | ✅ 完了 |
| Phase 2 | 設定ダイアログ + パレットポップオーバー | ✅ 完了 |
| Phase 3 | デバッグパネル左側独立化 | ✅ 完了 |
| Phase 4 | POIカードリデザイン | ✅ 完了 |
| Phase 5 | モバイル対応 | ❌ 未着手 |

## 完了した変更の詳細

### Phase 1: レイアウト基盤変更
- CSS Grid → フルビューポートダーク背景 (`#0e0e14`) + フローティング要素
- HTML構造変更: `header`, `sidebar-right`, `footer` を廃止 → `toolbar`, `debug-panel`, `poi-panel`, `progress-bar` に置き換え
- `app-root.tsx` のportal先を新コンポーネントに差し替え
- フローティングツールバー作成 (`src/view/toolbar/index.tsx`)
- POIパネル作成 (`src/view/poi-panel/index.tsx`)
- フローティング進捗バー作成 (`src/view/progress-bar/index.tsx`)

### Phase 2: 設定ダイアログ + パレットポップオーバー
- 設定ダイアログ (`src/view/settings-dialog/index.tsx`): 2カラムレイアウト
  - 左カラム: Rendering (Renderer Type, WASM, Max Canvas Size, Worker Count)
  - 右カラム: Exploration, Supersampling Output, About (GitHub, Language, Debug Mode, Help)
- パレットポップオーバー (`src/view/palette-popover/index.tsx`): Radix UI Popover使用、キャンバスを見ながらリアルタイム調整可能
- アニメーション設定はパレットポップオーバー内に配置（セパレータで区切り）
- ツールバーをコンパクト化: `[Lucky] [Share] [Save] [SS] | [Palette] [Settings] | [Debug] [POI]`

### Phase 3: デバッグパネル左側独立化
- 左側スライドインパネル (`src/view/debug-panel/index.tsx`)
- ツールバー下に配置 (`top-16`)、DEBUGバッジ + 閉じるボタン
- POIパネルと同時表示可能（広い画面）、1440px以下では排他
- ショートカットキーなし、ツールバーのDebugトグルボタンで開閉
- ビューポート幅に応じた段階的パネル幅 (436/500/636px)
- `isDebugMode=false` 時は中身をアンマウントしてパフォーマンス改善
- SVGヒートマップを `viewBox` + `w-full` でレスポンシブ化、`React.memo` 追加
- キャンバス中央配置: `#canvas-wrapper` の `left`/`right` をパネル幅分調整 (`useCanvasPositionAdjust`)

### Phase 4: POIカードリデザイン
- 横型カード → 縦型カード (サムネイル上部 + r/N値・ボタン下部)
- サムネイル: 100x100 → 幅いっぱい正方形 (`w-full aspect-square`)
- サムネイル生成サイズ: 100px → 175px
- グリッド: `grid-cols-2` 固定 → `repeat(auto-fill, minmax(170px, 1fr))` で自動列数
- ネイティブスクロール (`overflow-y-scroll`) に変更、常時スクロールバー表示
- ダークモードに合うスクロールバーカスタマイズ (`scrollbar-width: thin; scrollbar-color`)

### 計画外の追加変更
- **POIパネル動的幅**: 余り幅に応じて400/580/760/940/1120pxに段階変更、2〜6列対応 (`src/view/use-panel-layout.tsx`)
- **パネル幅計算の集約**: `usePanelLayout` フックでデバッグパネル幅・POIパネル幅を一元管理
- **ビューポート幅追跡**: throttle付きresizeリスナー (150ms) で段階的列数切替のスキップを防止
- **windowResized無効化**: キャンバスサイズは `maxCanvasSize` 設定で制御に統一、パネル開閉によるリサイズ発火を防止
- **UI上のクリック伝播防止**: `isOnUIOverlay` ガードでフローティングUI上のマウスイベントがキャンバスに伝播するのを防止
- **プログレスバー幅拡大**: 500px固定
- **POIパネル閉じ時のミニストリップ**: 80px幅、パネル開閉ボタン + POI保存ボタン + サムネイル一覧（クリックでジャンプ）

## 現在のファイル構成

### 新規作成されたファイル
- `src/view/toolbar/index.tsx` - フローティングツールバー
- `src/view/poi-panel/index.tsx` - POI専用パネル（開閉式 + 閉じ時ミニストリップ）
- `src/view/settings-dialog/index.tsx` - 設定ダイアログ（2カラム）
- `src/view/palette-popover/index.tsx` - パレットポップオーバー
- `src/view/debug-panel/index.tsx` - デバッグパネル（左側）
- `src/view/debug-panel/use-is-wide-viewport.tsx` - ビューポート幅判定フック
- `src/view/progress-bar/index.tsx` - フローティング進捗バー
- `src/view/use-panel-layout.tsx` - パネル幅計算の集約フック

### 廃止されたファイル
- `src/view/header/index.tsx` → Toolbar に置き換え
- `src/view/right-sidebar/index.tsx` → POIPanel に置き換え
- `src/view/right-sidebar/operations.tsx` → POIPanel に統合

### 変更されたファイル
- `index.html` - DOM構造変更
- `src/style.css` - Grid → フローティング、スクロールバーカスタマイズ
- `src/main.tsx` - windowResized無効化、isOnUIOverlayガード追加
- `src/view/app-root.tsx` - portal先変更、useCanvasPositionAdjust追加
- `src/view/right-sidebar/poi-card.tsx` - 縦型レイアウト
- `src/view/right-sidebar/poi-card-preview.tsx` - サイズ変更
- `src/view/right-sidebar/poi.tsx` - auto-fillグリッド
- `src/view/right-sidebar/palette-editor.tsx` - アニメーション設定追加
- `src/view/right-sidebar/debug-mode/block-heatmap.tsx` - viewBox化、React.memo
- `src/view/right-sidebar/debug-mode/batch-render-viewer.tsx` - viewBox化
- `src/view/right-sidebar/use-poi.tsx` - サムネイル175px
- `src/view/header/actions.tsx` - InterestingPointsToggle削除
- `src/p5-adapter/utils.ts` - isOnUIOverlay追加
- `src/store/store.ts` - poiPanelOpen追加
- `src/poi-history/poi-history.ts` - サムネイル175px

## 決定事項 (2026-04-04)

- パレットエディタ: **独立ポップオーバー** (変更結果を見ながら調整したいため)
- 狭い画面 (1440px以下) でデバッグ+POI: **排他** (メインcanvasを邪魔してはならない)
- POIパネルのデフォルト状態: **開いた状態**
- ツールバーの位置: **左上固定**
- ショートカットキー: **不要** (ブラウザ/OSと干渉するため)

## 残りの作業: Phase 5 モバイル対応

- メディアクエリ追加 (768px以下)
- ツールバー: アイコンのみでコンパクト化
- POIパネル → BottomSheet (下からスライドアップ、ドラッグハンドル付き、3段階スナップ)
- 進捗バー: 画面最下部にフローティング

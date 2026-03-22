import type { Dictionary } from "./types";

/**
 * 日本語辞書
 *
 * enと同じキーセットを持つことがDictionary型で強制される。
 */
export const ja: Dictionary = {
  // header
  "header.debugMode": "デバッグモード",
  "header.instructions": "操作説明",

  // header actions
  "header.share": "共有",
  "header.saveImage": "画像を保存",
  "header.imageSaved": "画像を保存しました！",
  "header.supersamplingX2": "スーパーサンプリング x2",
  "header.showPointMarker": "ポイントマーカーを表示",
  "header.interestingPointsTooltip1": "フラクタル上の興味深いポイントをマークします。",
  "header.interestingPointsTooltip2": "マーカーをクリックするとその中心にズームします。",

  // settings
  "settings.rendererType": "レンダラー",
  "settings.switchedToWebGPU": "WebGPUレンダラーに切り替えました",
  "settings.switchedToP5js": "P5.jsレンダラーに切り替えました",
  "settings.webgpu": "WebGPU（高速）",
  "settings.p5js": "P5.js（互換）",
  "settings.zoomRate": "ズーム倍率",
  "settings.workerCount": "ワーカー数",
  "settings.animationFrequency": "アニメーション頻度",
  "settings.none": "なし",
  "settings.animationCycleStep": "アニメーション周期ステップ",
  "settings.maxCanvasSize": "最大キャンバスサイズ",
  "settings.supersamplingWidth": "スーパーサンプリング出力幅",
  "settings.supersamplingHeight": "スーパーサンプリング出力高さ",
  "settings.importPOIList": "POIリストのインポート",
  "settings.importFromClipboard": "クリップボードからインポート",
  "settings.poiImportFailed": "クリップボードからPOIリストのインポートに失敗しました！",
  "settings.poiImportSuccess": "クリップボードからPOIリストをインポートしました！",
};

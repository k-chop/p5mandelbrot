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

  // share dialog
  "share.noPreview": "プレビューなし",
  "share.copied": "コピーしました！",
  "share.copyAll": "すべてコピー",
  "share.copyUrlAndImage": "URL & 画像をコピー",
  "share.copyFailed": "クリップボードへのコピーに失敗しました",

  // operations tabs
  "operations.palette": "パレット",
  "operations.settings": "設定",
  "operations.outdatedApp": "このアプリは古いバージョンです。",
  "operations.visitNewAppBefore": "新しいアプリは ",
  "operations.visitNewAppAfter": " をご利用ください。",
  "operations.exportImportHint": "POIリストのエクスポート/インポートはこのボタンを使ってください。",
  "operations.poiListCopied": "POIリストのJSONをクリップボードにコピーしました！",
  "operations.copyPoiList": "POIリストをクリップボードにコピー",

  // palette editor
  "palette.palette": "パレット",
  "palette.selectPalette": "パレットを選択",
  "palette.paletteLength": "パレット長",
  "palette.paletteOffset": "パレットオフセット",

  // poi
  "poi.savePOI": "POIを保存",
  "poi.regenerateThumbnail": "サムネイルを再生成",
  "poi.apply": "適用",
  "poi.delete": "削除",

  // informations
  "info.refOrbitPinned": "参照軌道を固定中",
  "info.pressToUnpin": "解除するには",
  "info.pressToUnpinSuffix": "を押してください",

  // footer
  "footer.invalidResult": "無効な結果",
  "footer.calcRefOrbit": "参照軌道の計算",
  "footer.calcIteration": "反復計算",

  // instructions
  "instructions.mouse": "マウス",
  "instructions.keys": "キー",
  "instructions.zoom": "ズーム",
  "instructions.zoomAtClickedPoint": "クリック位置でズーム",
  "instructions.changeCenter": "中心を移動",
  "instructions.interactiveZoom": "インタラクティブなズームと中心移動",
  "instructions.changePalette": "パレット変更",
  "instructions.toggleMode": "モード切替",
  "instructions.resetR": "r を 2.0 にリセット",
  "instructions.supersampling": "現在位置をスーパーサンプリング(x2)",
  "instructions.changeMaxIteration": "最大反復回数を変更 (±100)",
  "instructions.changeMaxIterationWisely": "最大反復回数を賢く変更 (たぶん)",
  "instructions.resetIteration10000": "反復回数を10000にリセット",
  "instructions.resetIteration500": "反復回数を500にリセット",

  // parameters
  "parameters.maxIteration": "最大反復回数",
  "parameters.changeMaxIteration": "最大反復回数を変更",
  "parameters.iterationAtCursor": "カーソル位置の反復回数",
  "parameters.notEnoughPrecision": "精度が不足しています。",
  "parameters.switchToPerturbation": "摂動モードに切り替えるには",
  "parameters.switchToPerturbationSuffix": "キーを押してください。",

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

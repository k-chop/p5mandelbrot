import type { Dictionary } from "./types";

/**
 * 日本語辞書
 *
 * enと同じキーセットを持つことがDictionary型で強制される。
 */
export const ja: Dictionary = {
  // header
  "header.debugMode": "デバッグモード",
  "header.switchLanguage": "言語を切り替え",
  "header.debugModeTooltip": "レンダリング結果から得られるデバッグデータを表示します。",
  "header.instructions": "操作説明",

  // header actions
  "header.share": "共有",
  "header.saveImage": "画像を保存",
  "header.imageSaved": "画像を保存しました！",
  "header.saveImageTooltip": "canvasの内容をPNG画像としてダウンロードします。",
  "header.supersamplingX2": "スーパーサンプリング x2",
  "header.showPointMarker": "マーカーを表示",
  "header.interestingPointsTooltip1": "拡大すると面白そうなポイントをマークします。",
  "header.interestingPointsTooltip2": "マーカーをクリックするとその中心にズームします。",
  "header.randomJump": "I'm Feeling Lucky",
  "header.randomJumpTooltip": "マンデルブロ集合の秘境へ連れて行くぜ。",

  // toolbar
  "toolbar.togglePOIPanel": "POIパネルの表示切替",
  "toolbar.jump": "ジャンプ",
  "toolbar.jumpToCoordinates": "座標を指定してジャンプ",
  "toolbar.pasteCoordinates": "座標情報を入力",
  "toolbar.currentValue": "現在の値",
  "toolbar.parseError": "パラメータを認識できませんでした",
  "toolbar.invalidCoordinates": "座標の値が不正です",
  "toolbar.invalidRadius": "半径の値が不正です",
  "toolbar.invalidIteration": "反復回数の値が不正です",
  "toolbar.parseFailed": "パラメータの解析に失敗しました",

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

  // palette editor
  "palette.palette": "パレット",
  "palette.selectPalette": "パレットを選択",
  "palette.paletteLength": "パレット周期の長さ",
  "palette.paletteOffset": "オフセット",

  // poi
  "poi.savePOI": "POIを保存",
  "poi.regenerateThumbnail": "サムネイルを再生成",
  "poi.thumbnailRegenerated": "サムネイルを再生成しました",
  "poi.apply": "適用",
  "poi.delete": "削除",
  "poi.export": "Export",
  "poi.import": "Import",
  "poi.exportTitle": "POI Export",
  "poi.importTitle": "POI Import",
  "poi.exportCount": "{count}件のPOI",
  "poi.copyToClipboard": "クリップボードにコピー",
  "poi.pasteHere": "エクスポートしたPOIテキストを貼り付け...",
  "poi.importParsed": "{count}件パース済み",
  "poi.importNew": "{count}件が新規",
  "poi.importDuplicates": "{count}件は重複のため無視",
  "poi.importButton": "{count}件のPOIをインポート",

  // preset
  "preset.title": "Preset",
  "preset.count": "{count}件のプリセット",

  // footer
  "footer.invalidResult": "無効な結果",
  "footer.calcRefOrbit": "参照軌道の計算",
  "footer.calcIteration": "Iteration",
  "footer.elapsedPrefix": "処理時間: ",

  // bump
  "bump.increaseN": "最大反復数を増やす",

  // instructions
  "instructions.mouse": "マウス",
  "instructions.keys": "キー",
  "instructions.zoom": "ズーム",
  "instructions.zoomAtClickedPoint": "クリック位置でズーム",
  "instructions.changeCenter": "ドラッグで中心を移動",
  "instructions.interactiveZoom": "ドラッグ開始点を中心に動的なズーム",
  "instructions.changePalette": "パレット変更",
  "instructions.resetR": "r を 2.0 にリセット",
  "instructions.supersampling": "現在位置をスーパーサンプリング(x2)",
  "instructions.changeMaxIteration": "最大iterationを変更 (±100)",
  "instructions.changeMaxIterationWisely": "最大iterationを賢く変更 (たぶん)",
  "instructions.resetIteration10000": "iterationを10000にリセット",
  "instructions.resetIteration500": "iterationを500にリセット",

  // settings
  "settings.rendererType": "レンダラー",
  "settings.switchedToWebGPU": "WebGPUレンダラーに切り替えました",
  "settings.switchedToP5js": "P5.jsレンダラーに切り替えました",
  "settings.webgpu": "WebGPU（高速）",
  "settings.p5js": "P5.js（WebGPUが使えない環境向け）",
  "settings.zoomRate": "ズーム倍率",
  "settings.workerCount": "Worker数",
  "settings.animationFrequency": "アニメーション頻度",
  "settings.none": "なし",
  "settings.animationCycleStep": "アニメーション周期ステップ",
  "settings.maxCanvasSize": "最大キャンバスサイズ",
  "settings.outputSize": "出力サイズ",
  "settings.displaySize": "ディスプレイサイズ",
  "settings.custom": "カスタム",
  "settings.generate": "生成",
  "settings.useWasm": "Reference Orbit計算にWasmを使用",
  "settings.useWasmTooltip": "10倍ほど高速になるのでON推奨",

  // dialog descriptions (a11y用、視覚的には非表示)
  "dialog.description.share": "現在の表示をURLで共有",
  "dialog.description.jump": "指定した座標にジャンプ",
  "dialog.description.settings": "アプリケーション設定",
  "dialog.description.instructions": "操作方法の説明",
  "dialog.description.minimap": "保存したPOIの全体マップ",
  "dialog.description.presetList": "プリセットPOI一覧",
  "dialog.description.poiPanel": "保存したPOI",
  "dialog.description.supersampling": "スーパーサンプリング設定",
  "dialog.description.benchmark": "ベンチマーク進行状況",
  "dialog.description.poiExport": "保存したPOIをエクスポート",
  "dialog.description.poiImport": "テキストからPOIをインポート",

  // debug mode
  "debug.alwaysComputeDebugData": "常にデバッグデータを計算",
  "debug.alwaysComputeTooltip1": "このタブが閉じていてもデバッグデータを計算します。",
  "debug.alwaysComputeTooltip2": "描画が遅くなる場合があります。",
  "debug.clickBlockToShowDetail": "ブロックをクリックすると詳細を表示",
  "debug.exportEvalTooltip1":
    "./tmp/eval以下にエージェントが評価する用のデータをエクスポートする。",
  "debug.exportEvalTooltip2": "ローカルでdev-allで起動したときのみ有効。",
};

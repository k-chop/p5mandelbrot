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
};

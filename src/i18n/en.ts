/**
 * 英語辞書（Source of Truth）
 *
 * すべての翻訳キーはこの辞書で定義する。
 * キーはドット区切り、値は英語テキスト。
 * `as const` でリテラル型を保持する。
 */
export const en = {
  // header
  "header.debugMode": "Debug Mode",
  "header.instructions": "Instructions",

  // header actions
  "header.share": "Share",
  "header.saveImage": "Save Image",
  "header.imageSaved": "Image saved!",
  "header.supersamplingX2": "Supersampling x2",
  "header.showPointMarker": "Show point marker",
  "header.interestingPointsTooltip1": "Marks interesting points on the fractal.",
  "header.interestingPointsTooltip2": "Click a marker to zoom into its center.",

  // share dialog
  "share.noPreview": "No preview",
  "share.copied": "Copied!",
  "share.copyAll": "Copy All",
  "share.copyUrlAndImage": "Copy URL & Image",
  "share.copyFailed": "Failed to copy to clipboard",

  // settings
  "settings.rendererType": "Renderer Type",
  "settings.switchedToWebGPU": "Switched to WebGPU renderer",
  "settings.switchedToP5js": "Switched to P5.js renderer",
  "settings.webgpu": "WebGPU (Faster)",
  "settings.p5js": "P5.js (Compatible)",
  "settings.zoomRate": "Zoom Rate",
  "settings.workerCount": "Worker Count",
  "settings.animationFrequency": "Animation Frequency",
  "settings.none": "None",
  "settings.animationCycleStep": "Animation Cycle Step",
  "settings.maxCanvasSize": "Max Canvas Size",
  "settings.supersamplingWidth": "Supersampling Output Width",
  "settings.supersamplingHeight": "Supersampling Output Height",
  "settings.importPOIList": "Import POI List",
  "settings.importFromClipboard": "Import from clipboard",
  "settings.poiImportFailed": "Failed to import POI List from clipboard!",
  "settings.poiImportSuccess": "POI List imported from clipboard!",
} as const;

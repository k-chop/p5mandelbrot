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

  // operations tabs
  "operations.palette": "Palette",
  "operations.settings": "Settings",
  "operations.outdatedApp": "This is outdated app.",
  "operations.visitNewAppBefore": "Please visit ",
  "operations.visitNewAppAfter": " to use new app.",
  "operations.exportImportHint": "If you wish to export/import the POI list, use this button.",
  "operations.poiListCopied": "POI List JSON copied to clipboard!",
  "operations.copyPoiList": "Copy POI List to clipboard",

  // palette editor
  "palette.palette": "Palette",
  "palette.selectPalette": "Select a palette",
  "palette.paletteLength": "Palette Length",
  "palette.paletteOffset": "Palette Offset",

  // poi
  "poi.savePOI": "Save POI",
  "poi.regenerateThumbnail": "Regenerate thumbnail",
  "poi.apply": "Apply",
  "poi.delete": "Delete",

  // instructions
  "instructions.mouse": "Mouse",
  "instructions.keys": "Keys",
  "instructions.zoom": "Zoom",
  "instructions.zoomAtClickedPoint": "Zoom at clicked point",
  "instructions.changeCenter": "Change center",
  "instructions.interactiveZoom": "Interactive zoom and change center",
  "instructions.changePalette": "Change Palette",
  "instructions.toggleMode": "Toggle mode",
  "instructions.resetR": "Reset r to 2.0",
  "instructions.supersampling": "Supersampling(x2) current location",
  "instructions.changeMaxIteration": "Change max iteration (±100)",
  "instructions.changeMaxIterationWisely": "Change max iteration wisely (maybe)",
  "instructions.resetIteration10000": "Reset iteration count to 10000",
  "instructions.resetIteration500": "Reset iteration count to 500",

  // parameters
  "parameters.maxIteration": "MAX Iteration",
  "parameters.changeMaxIteration": "Change Max Iteration",
  "parameters.iterationAtCursor": "Iteration at cursor",
  "parameters.notEnoughPrecision": "Not enough precision.",
  "parameters.switchToPerturbation": "Switch to perturbation mode by",
  "parameters.switchToPerturbationSuffix": "key.",

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

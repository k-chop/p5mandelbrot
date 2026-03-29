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
  "header.switchLanguage": "Switch language",
  "header.debugModeTooltip": "Shows debug data obtained from rendering results.",
  "header.instructions": "Instructions",

  // header actions
  "header.share": "Share",
  "header.saveImage": "Save Image",
  "header.imageSaved": "Image saved!",
  "header.saveImageTooltip": "Downloads the canvas content as a PNG image.",
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
  "poi.export": "Export",
  "poi.import": "Import",
  "poi.exportTitle": "Export POI",
  "poi.importTitle": "Import POI",
  "poi.exportCount": "{count} POIs",
  "poi.copyToClipboard": "Copy to clipboard",
  "poi.pasteHere": "Paste exported POI text here...",
  "poi.importParsed": "{count} POIs parsed",
  "poi.importNew": "{count} new",
  "poi.importDuplicates": "{count} duplicates ignored",
  "poi.importButton": "Import {count} POIs",

  // footer
  "footer.invalidResult": "Invalid Result",
  "footer.calcRefOrbit": "Calculate Reference Orbit",
  "footer.calcIteration": "Calculate Iteration",

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
  "settings.useWasm": "Use Wasm for reference orbit",
  "settings.useWasmTooltip": "Approximately 10x faster. Recommended to keep ON.",
  // debug mode
  "debug.alwaysComputeDebugData": "Always compute debug data",
  "debug.alwaysComputeTooltip1": "Computes debug data even when this tab is closed.",
  "debug.alwaysComputeTooltip2": "May slow down rendering.",
  "debug.clickBlockToShowDetail": "Click a block to show details",
  "debug.exportEvalTooltip1": "Exports data for agent evaluation to ./tmp/eval/.",
  "debug.exportEvalTooltip2": "Only available when running locally with dev-all.",
} as const;

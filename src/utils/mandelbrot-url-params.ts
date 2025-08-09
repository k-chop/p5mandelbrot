import { getCurrentPalette } from "@/camera/palette";
import { deserializePalette } from "@/color";
import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { MandelbrotWorkerType, mandelbrotWorkerTypes } from "@/types";
import BigNumber from "bignumber.js";

/**
 * URLのquery parameterから描画内容を復元する
 *
 * ShareされたURLを読み込んだ時に使う
 */
export const extractMandelbrotParams = () => {
  const params = new URLSearchParams(location.search);

  const x = params.get("x");
  const y = params.get("y");
  const r = params.get("r");
  const N = params.get("N") || "NaN";
  const mode = params.get("mode");
  const palette = params.get("palette");

  if (x === null || y === null || r === null) {
    // modeはなければnormal、Nはなければ500
    return null;
  }

  // 共有されたURLを読み込んだあとは消しておく
  history.replaceState({}, "", location.origin);

  try {
    const safeN = isNaN(parseInt(N, 10)) ? 500 : parseInt(N, 10);
    const safeMode = mandelbrotWorkerTypes.some((t) => t === mode)
      ? (mode as MandelbrotWorkerType)
      : "normal";
    const safeX = new BigNumber(x);
    const safeY = new BigNumber(y);
    const safeR = new BigNumber(r);

    // パレットは復元できなければ初期値をそのまま使う
    let safePalette = getCurrentPalette();
    if (palette != null) {
      safePalette = deserializePalette(palette);
    }

    return {
      mandelbrot: {
        x: safeX,
        y: safeY,
        r: safeR,
        N: safeN,
        mode: safeMode,
      },
      palette: safePalette,
    };
  } catch (err) {
    console.error(err);

    return null;
  }
};

/**
 * shareボタン用に現在のパラメータをクリップボードにコピーする
 *
 * mandelbrot setの各種パラメータとpaletteの状態が乗る
 */
export const copyCurrentParamsToClipboard = () => {
  const { x, y, r, N, mode } = getCurrentParams();
  const palette = getCurrentPalette();

  const params = new URLSearchParams({
    x: x.toString(),
    y: y.toString(),
    r: r.toString(),
    N: N.toString(),
    mode,
    palette: palette.serialize(),
  });

  navigator.clipboard.writeText(`${location.origin}${location.pathname}?${params.toString()}`);
};

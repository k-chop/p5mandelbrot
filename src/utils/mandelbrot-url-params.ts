import { getCurrentPalette } from "@/camera/palette";
import { deserializePalette } from "@/color";
import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { getCanvasSize } from "@/rendering/renderer";
import type { MandelbrotWorkerType } from "@/types";
import { mandelbrotWorkerTypes } from "@/types";
import BigNumber from "bignumber.js";
import { decodeNumber, encodeNumber } from "./number-encoding";
import { decodePalette, encodePalette, PERTURBATION_THRESHOLD } from "./palette-encoding";

/**
 * URLのquery parameterから描画内容を復元する
 *
 * ShareされたURLを読み込んだ時に使う
 */
export const extractMandelbrotParams = () => {
  const params = new URLSearchParams(location.search);

  const mode = params.get("mode");
  const palette = params.get("palette");

  const compactParam = params.get("c");
  // 旧形式: ?x=...&y=...&r=...
  const x = params.get("x");
  const y = params.get("y");
  const r = params.get("r");

  if (compactParam === null && (x === null || y === null || r === null)) {
    return null;
  }

  // 共有されたURLを読み込んだあとは消しておく
  history.replaceState({}, "", location.origin);

  try {
    let safeX: BigNumber;
    let safeY: BigNumber;
    let safeR: BigNumber;
    let safeN: number;
    let safePalette = getCurrentPalette();

    if (compactParam !== null) {
      const parts = compactParam.split(".");
      if (parts.length === 8) {
        // 完全圧縮形式: ?c=<X>.<Y>.<R>.<N>.<paletteId>.<mirrored>.<length>.<offset>
        const [encodedX, encodedY, encodedR, nStr] = parts;
        safeX = new BigNumber(decodeNumber(encodedX));
        safeY = new BigNumber(decodeNumber(encodedY));
        safeR = new BigNumber(decodeNumber(encodedR));
        safeN = isNaN(parseInt(nStr, 10)) ? 500 : parseInt(nStr, 10);
        const paletteEncoded = parts.slice(4).join(".");
        safePalette = decodePalette(paletteEncoded);
      } else if (parts.length === 4) {
        // 前回形式: ?c=<X>.<Y>.<R>.<N> + mode/palette別パラメータ
        const [encodedX, encodedY, encodedR, nStr] = parts;
        safeX = new BigNumber(decodeNumber(encodedX));
        safeY = new BigNumber(decodeNumber(encodedY));
        safeR = new BigNumber(decodeNumber(encodedR));
        safeN = isNaN(parseInt(nStr, 10)) ? 500 : parseInt(nStr, 10);
        if (palette != null) {
          safePalette = deserializePalette(palette);
        }
      } else {
        throw new Error(`Invalid compact param: ${compactParam}`);
      }
    } else {
      safeX = new BigNumber(x!);
      safeY = new BigNumber(y!);
      safeR = new BigNumber(r!);
      const N = params.get("N") || "NaN";
      safeN = isNaN(parseInt(N, 10)) ? 500 : parseInt(N, 10);
      if (palette != null) {
        safePalette = deserializePalette(palette);
      }
    }

    // modeは明示パラメータがあればそれを使い、なければrから自動判定
    let safeMode: MandelbrotWorkerType;
    if (mode != null && mandelbrotWorkerTypes.some((t) => t === mode)) {
      safeMode = mode as MandelbrotWorkerType;
    } else {
      safeMode = safeR.isLessThan(PERTURBATION_THRESHOLD) ? "perturbation" : "normal";
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
 * 共有URLに載せるx, yの有効数字の桁数を算出する
 *
 * ビューポートの1ピクセルは複素平面上で 2*r/canvasWidth の距離に対応する。
 * x.toPrecision(n) の丸め誤差がこの距離未満になる最小の n を返す。
 *
 * 導出:
 *   toPrecision(n) の最大誤差 ≈ 5 * 10^(-n)  （|x| ≈ 1 のとき）
 *   5 * 10^(-n) < 2*r/W
 *   n > log10(W/(2r)) + log10(5)
 *   → ceil(log10(W/(2r))) + 2  （安全マージン込み）
 */
export const calcCoordPrecision = (r: BigNumber, canvasWidth: number): number => {
  // BigNumberの除算は DECIMAL_PLACES=20 に制約されるため、
  // log10 を個別に計算して合成する
  const rNum = r.toNumber();
  const log10r =
    rNum > 0 && isFinite(rNum)
      ? Math.log10(rNum)
      : -((r.decimalPlaces() ?? 20) - r.precision(true) + 1);
  return Math.ceil(Math.log10(canvasWidth / 2) - log10r) + 2;
};

/**
 * 現在のパラメータから共有URLを生成する
 *
 * x, yはビューポートの1ピクセル精度を保つ最小限の有効数字に丸める。
 * rはズームレベルなので有効数字6桁で十分（相対精度 2/canvasWidth ≈ 0.001）。
 */
export const buildCurrentParamsUrl = (): string => {
  const { x, y, r, N } = getCurrentParams();
  const palette = getCurrentPalette();
  const { width } = getCanvasSize();
  const coordPrecision = calcCoordPrecision(r, width);

  const encodedX = encodeNumber(x.toPrecision(coordPrecision));
  const encodedY = encodeNumber(y.toPrecision(coordPrecision));
  const encodedR = encodeNumber(r.toPrecision(6));
  const base = `${encodedX}.${encodedY}.${encodedR}.${N}`;

  const paletteEncoded = encodePalette(palette);
  // プリセットパレットは短いID形式（A.1.128.0）、非プリセットはserialize文字列
  const isPreset = /^[A-M]\./.test(paletteEncoded);

  if (isPreset) {
    const params = new URLSearchParams({ c: `${base}.${paletteEncoded}` });
    return `${location.origin}${location.pathname}?${params.toString()}`;
  } else {
    const params = new URLSearchParams({ c: base, palette: paletteEncoded });
    return `${location.origin}${location.pathname}?${params.toString()}`;
  }
};

/**
 * shareボタン用に現在のパラメータをクリップボードにコピーする
 *
 * mandelbrot setの各種パラメータとpaletteの状態が乗る
 */
export const copyCurrentParamsToClipboard = () => {
  void navigator.clipboard.writeText(buildCurrentParamsUrl());
};

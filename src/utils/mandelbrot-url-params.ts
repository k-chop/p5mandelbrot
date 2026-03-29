import { getCurrentPalette } from "@/camera/palette";
import { deserializePalette } from "@/color";
import type { Palette } from "@/color/model";
import { calcCoordPrecision } from "@/math/coord-precision";
import { safeParseInt } from "@/math/util";
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
        safeN = safeParseInt(nStr, 500);
        const paletteEncoded = parts.slice(4).join(".");
        safePalette = decodePalette(paletteEncoded);
      } else if (parts.length === 4) {
        // 前回形式: ?c=<X>.<Y>.<R>.<N> + mode/palette別パラメータ
        const [encodedX, encodedY, encodedR, nStr] = parts;
        safeX = new BigNumber(decodeNumber(encodedX));
        safeY = new BigNumber(decodeNumber(encodedY));
        safeR = new BigNumber(decodeNumber(encodedR));
        safeN = safeParseInt(nStr, 500);
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
      safeN = safeParseInt(N, 500);
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

export type ShareData = {
  url: string;
  x: string;
  y: string;
  r: string;
  N: number;
};

type BuildShareDataParams = {
  x: BigNumber;
  y: BigNumber;
  r: BigNumber;
  N: number;
  palette: Palette;
};

/**
 * パラメータから共有用データを生成する
 *
 * x, yはビューポートの1ピクセル精度を保つ最小限の有効数字に丸める。
 * rはズームレベルなので有効数字6桁で十分。
 */
export const buildShareData = (params: BuildShareDataParams): ShareData => {
  const { x, y, r, N, palette } = params;
  const coordPrecision = calcCoordPrecision(r);

  const xStr = x.toPrecision(coordPrecision);
  const yStr = y.toPrecision(coordPrecision);
  const rStr = r.toPrecision(6);

  const encodedX = encodeNumber(xStr);
  const encodedY = encodeNumber(yStr);
  const encodedR = encodeNumber(rStr);
  const base = `${encodedX}.${encodedY}.${encodedR}.${N}`;

  const paletteEncoded = encodePalette(palette);
  const isPreset = /^[A-M]\./.test(paletteEncoded);

  const url = isPreset
    ? `${location.origin}${location.pathname}?${new URLSearchParams({ c: `${base}.${paletteEncoded}` }).toString()}`
    : `${location.origin}${location.pathname}?${new URLSearchParams({ c: base, palette: paletteEncoded }).toString()}`;

  return { url, x: xStr, y: yStr, r: rStr, N };
};

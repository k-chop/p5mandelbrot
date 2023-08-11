import { getCurrentParams } from "@/mandelbrot";
import { MandelbrotWorkerType, mandelbrotWorkerTypes } from "@/types";
import BigNumber from "bignumber.js";

export const extractMandelbrotParams = () => {
  const params = new URLSearchParams(location.search);

  const x = params.get("x");
  const y = params.get("y");
  const r = params.get("r");
  const N = params.get("N") || "NaN";
  const mode = params.get("mode");

  if (x === null || y === null || r === null) {
    // modeはなければnormal、Nはなければ500
    return null;
  }

  try {
    const safeN = isNaN(parseInt(N, 10)) ? 500 : parseInt(N, 10);
    const safeMode = mandelbrotWorkerTypes.some((t) => t === mode)
      ? (mode as MandelbrotWorkerType)
      : "normal";
    const safeX = new BigNumber(x);
    const safeY = new BigNumber(y);
    const safeR = new BigNumber(r);

    return {
      x: safeX,
      y: safeY,
      r: safeR,
      N: safeN,
      mode: safeMode,
    };
  } catch (err) {
    console.error(err);

    return null;
  }
};

export const copyCurrentParamsToClipboard = () => {
  const { x, y, r, N, mode } = getCurrentParams();

  const params = new URLSearchParams({
    x: x.toString(),
    y: y.toString(),
    r: r.toString(),
    N: N.toString(),
    mode,
  });

  navigator.clipboard.writeText(
    `${location.origin}${location.pathname}?${params.toString()}`,
  );
};

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

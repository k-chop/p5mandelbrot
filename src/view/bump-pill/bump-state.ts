import type BigNumber from "bignumber.js";

/** バンプ操作後、効果判定で「効いた」とみなす比率: 新比率 ≤ 旧比率/2 */
const EFFECTIVENESS_RATIO = 0.5;

/** iteration=N到達率がこの値を超えたときにバンプピルを表示する */
export const BUMP_DISPLAY_THRESHOLD = 0.01;

type BumpContext = {
  ratioBefore: number;
  paramsHash: string;
};

let lastBumpContext: BumpContext | null = null;

/**
 * x/y/r を合成した位置識別キーを返す
 *
 * これが同じなら「同じ場所」とみなし、バンプの効果追跡を引き継ぐ
 */
export const makeParamsHash = (x: BigNumber, y: BigNumber, r: BigNumber): string =>
  `${x.toString()}|${y.toString()}|${r.toString()}`;

/**
 * バンプピル押下時に呼ぶ。直前の比率と場所を記憶する
 */
export const recordBump = (ratioBefore: number, paramsHash: string) => {
  lastBumpContext = { ratioBefore, paramsHash };
};

/**
 * バンプピルを表示すべきかを判定する
 *
 * - 比率が閾値以下なら非表示
 * - 直前のバンプが同じ場所で行われていて、効果が弱かった場合は非表示（minibrot対策）
 */
export const shouldShowBumpPill = (ratio: number, paramsHash: string): boolean => {
  if (ratio <= BUMP_DISPLAY_THRESHOLD) return false;

  if (lastBumpContext && lastBumpContext.paramsHash === paramsHash) {
    // 同じ場所で前回バンプした。新比率が旧比率の半分以下に落ちていないなら効果なしと判断
    if (ratio > lastBumpContext.ratioBefore * EFFECTIVENESS_RATIO) {
      return false;
    }
  }

  return true;
};

/**
 * バンプ追跡をリセットする。場所移動時などに呼ぶ
 */
export const clearBumpContext = () => {
  lastBumpContext = null;
};

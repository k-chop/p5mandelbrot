import { useT } from "@/i18n/context";
import { setManualN } from "@/mandelbrot-state/mandelbrot-state";
import { useStoreValue } from "@/store/store";
import { useIsMobile } from "@/view/use-is-mobile";
import clsx from "clsx";
import { TriangleAlert } from "lucide-react";
import { makeParamsHash, recordBump, shouldShowBumpPill } from "./bump-state";

/** 小Nで固定増加に切り替える閾値。未満は固定量、以上は比率で上積みする */
const BUMP_THRESHOLD = 10000;
/** N<BUMP_THRESHOLD時の固定増加量 */
const BUMP_STEP_SMALL = 2000;
/** N>=BUMP_THRESHOLD時の増加率 (+30%) */
const BUMP_RATE_LARGE = 0.3;

/**
 * iteration=N到達率が高いときだけ表示される「N不足→バンプ」操作ピル
 *
 * Mobile: 画面下中央、footerのすぐ上
 * PC: 画面右下、Footer BarGraphの右側
 */
export const BumpPill = () => {
  const t = useT();
  const isMobile = useIsMobile();
  const nHitRatio = useStoreValue("nHitRatio");
  const N = useStoreValue("N");
  const centerX = useStoreValue("centerX");
  const centerY = useStoreValue("centerY");
  const r = useStoreValue("r");

  if (nHitRatio == null) return null;

  const paramsHash = makeParamsHash(centerX, centerY, r);
  if (!shouldShowBumpPill(nHitRatio, paramsHash)) return null;

  const handleClick = () => {
    recordBump(nHitRatio, paramsHash);
    const bumpAmount =
      N < BUMP_THRESHOLD ? BUMP_STEP_SMALL : Math.max(1, Math.floor(N * BUMP_RATE_LARGE));
    setManualN(N + bumpAmount);
  };

  const positionClass = isMobile ? "bottom-10 left-1/2 -translate-x-1/2" : "bottom-20 left-3";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        "fixed z-[95] flex items-center gap-1.5 rounded-full border-2 border-[var(--tomato-10)] bg-[#1c1c24]/95 px-4 py-2 text-sm font-medium text-[var(--sage-12)] shadow-[0_0_20px_rgba(229,77,46,0.4),0_4px_12px_rgba(0,0,0,0.6)] backdrop-blur-sm transition hover:bg-[#26262e]/95 active:scale-95",
        positionClass,
      )}
    >
      <TriangleAlert className="size-[18px] shrink-0 text-[var(--tomato-11)]" />
      <span>{t("Increase max iteration", "bump.increaseN")}</span>
    </button>
  );
};

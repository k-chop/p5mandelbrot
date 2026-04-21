import { useT } from "@/i18n/context";
import { setManualN } from "@/mandelbrot-state/mandelbrot-state";
import { useStoreValue } from "@/store/store";
import { useIsMobile } from "@/view/use-is-mobile";
import clsx from "clsx";
import { TriangleAlert } from "lucide-react";
import { makeParamsHash, recordBump, shouldShowBumpPill } from "./bump-state";

/** バンプ率: 現在のNに +30% 上積みする */
const BUMP_RATE = 0.3;

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
    const bumpAmount = Math.max(1, Math.floor(N * BUMP_RATE));
    setManualN(N + bumpAmount);
  };

  const positionClass = isMobile
    ? "bottom-7 left-1/2 -translate-x-1/2"
    : "right-4 bottom-5 -translate-x-0";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        "fixed z-[95] flex items-center gap-1.5 rounded-full border border-[var(--tomato-9)] bg-[#1c1c24]/95 px-4 py-2 text-sm font-medium text-[var(--sage-12)] shadow-lg backdrop-blur-sm transition hover:bg-[#26262e]/95 active:scale-95",
        positionClass,
      )}
    >
      <TriangleAlert className="size-4 text-[var(--tomato-11)]" />
      <span>{t("Low N", "bump.lowN")}</span>
      <span className="font-mono">+30%</span>
    </button>
  );
};

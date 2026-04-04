import { updateStore, useStoreValue } from "@/store/store";
import { createContext, use, useEffect, useState } from "react";
import { useIsWideViewport } from "./debug-panel/use-is-wide-viewport";

/** パネル排他の閾値(px) */
const EXCLUSIVE_BREAKPOINT = 1440;

/**
 * ビューポート幅をthrottle付きで返すフック
 *
 * パネル幅の閾値計算に使う。150ms throttleでリサイズ中も定期的に更新する。
 */
const useViewportWidth = (): number => {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    let lastUpdate = 0;
    let rafId: number | null = null;

    const handler = () => {
      const now = Date.now();
      if (now - lastUpdate >= 150) {
        lastUpdate = now;
        setWidth(window.innerWidth);
      } else if (rafId == null) {
        const remaining = 150 - (now - lastUpdate);
        rafId = window.setTimeout(() => {
          lastUpdate = Date.now();
          setWidth(window.innerWidth);
          rafId = null;
        }, remaining);
      }
    };

    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      if (rafId != null) clearTimeout(rafId);
    };
  }, []);

  return width;
};

/**
 * デバッグパネルの幅(px)をビューポート幅に応じて返す
 *
 * 2200px以上: 636、1800px以上: 500、それ以下: 436
 */
const useDebugPanelWidthValue = (): number => {
  const isUltraWide = useIsWideViewport(2200);
  const isWide = useIsWideViewport(1800);

  if (isUltraWide) return 636;
  if (isWide) return 500;
  return 436;
};

/**
 * POIパネルの幅(px)を余り幅に応じて返す
 *
 * 余り幅 = ビューポート - デバッグパネル幅(開いてれば) - キャンバス幅 - 余白
 * カード幅175px固定で、何列入るかで段階的にパネル幅を決定する。
 */
const calcPOIPanelWidth = (
  debugPanelWidth: number,
  viewportWidth: number,
  isDebugMode: boolean,
  maxCanvasSize: number,
): number => {
  const canvasWidth = maxCanvasSize === -1 ? 1024 : Math.min(maxCanvasSize, viewportWidth);
  const activeDebugWidth = isDebugMode ? debugPanelWidth : 0;

  const canFit = (poiWidth: number) =>
    viewportWidth >= activeDebugWidth + poiWidth + canvasWidth + 200;

  if (canFit(1120)) return 1120;
  if (canFit(940)) return 940;
  if (canFit(760)) return 760;
  if (canFit(580)) return 580;
  return 400;
};

/** パネルレイアウト情報の型 */
type PanelLayout = {
  debugPanelWidth: number;
  poiPanelWidth: number;
};

const PanelLayoutContext = createContext<PanelLayout | null>(null);

/**
 * パネルレイアウト情報を提供するProvider
 *
 * AppRootの直下で1回だけ使用する。resize/matchMediaリスナーを1セットだけ登録し、
 * 子コンポーネントはContextから値を取得する。
 */
export const PanelLayoutProvider = ({ children }: { children: React.ReactNode }) => {
  const viewportWidth = useViewportWidth();
  const debugPanelWidth = useDebugPanelWidthValue();
  const isDebugMode = useStoreValue("isDebugMode");
  const maxCanvasSize = useStoreValue("maxCanvasSize");
  const poiPanelWidth = calcPOIPanelWidth(
    debugPanelWidth,
    viewportWidth,
    isDebugMode,
    maxCanvasSize,
  );

  return (
    <PanelLayoutContext value={{ debugPanelWidth, poiPanelWidth }}>{children}</PanelLayoutContext>
  );
};

/**
 * パネルレイアウト情報をContextから取得するフック
 *
 * PanelLayoutProvider内で使用する必要がある。
 */
export const usePanelLayout = (): PanelLayout => {
  const ctx = use(PanelLayoutContext);
  if (!ctx) throw new Error("usePanelLayout must be used within PanelLayoutProvider");
  return ctx;
};

/**
 * 狭い画面でのデバッグパネルとPOIパネルの排他制御
 *
 * 1440px以下の場合、一方を開くと他方を閉じる。
 * AppRoot内で1回だけ呼び出す。
 */
export const useExclusivePanels = () => {
  const isDebugMode = useStoreValue("isDebugMode");
  const poiPanelOpen = useStoreValue("poiPanelOpen");
  const isNarrow = !useIsWideViewport(EXCLUSIVE_BREAKPOINT);

  useEffect(() => {
    if (isNarrow && isDebugMode) {
      updateStore("poiPanelOpen", false);
    }
  }, [isNarrow, isDebugMode]);

  useEffect(() => {
    if (isNarrow && poiPanelOpen) {
      updateStore("isDebugMode", false);
    }
  }, [isNarrow, poiPanelOpen]);
};

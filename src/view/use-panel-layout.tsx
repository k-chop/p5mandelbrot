import { updateStore, useStoreValue } from "@/store/store";
import { createContext, use, useEffect, useState } from "react";
import { useIsWideViewport } from "./debug-panel/use-is-wide-viewport";
import { COLLAPSED_STRIP_WIDTH } from "./poi-panel";

/** パネル排他の閾値(px) */
const EXCLUSIVE_BREAKPOINT = 1440;

/** デバッグパネルの最大幅(px) */
const DEBUG_PANEL_MAX = 500;

/** デバッグパネルの最小幅(px) */
const DEBUG_PANEL_MIN = 436;

/** POIパネルの最小幅(px) */
const POI_PANEL_MIN = 400;

/** パネル間の余白(px) */
const LAYOUT_MARGIN = 200;

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
 * POIパネルの幅(px)をステップ値から選択する
 *
 * debugReservedを予約した上で、収まる最大のステップ幅を返す。
 */
const calcPOIPanelWidth = (
  viewportWidth: number,
  debugReserved: number,
  canvasWidth: number,
): number => {
  const canFit = (poiWidth: number) =>
    viewportWidth >= debugReserved + poiWidth + canvasWidth + LAYOUT_MARGIN;

  if (canFit(1120)) return 1120;
  if (canFit(940)) return 940;
  if (canFit(760)) return 760;
  if (canFit(580)) return 580;
  return POI_PANEL_MIN;
};

/**
 * デバッグパネルとPOIパネルの幅を同時に算出する
 *
 * debugが最大幅に到達できるならMAXを予約してからPOIのステップ幅を決める。
 * 到達できない場合はPOIにMINを予約して、残りをdebugに割り当てる。
 */
const calcPanelWidths = (
  viewportWidth: number,
  isDebugMode: boolean,
  canvasWidth: number,
  poiPanelOpen: boolean,
): { debugPanelWidth: number; poiPanelWidth: number } => {
  const budget = viewportWidth - canvasWidth - LAYOUT_MARGIN;

  if (!isDebugMode) {
    // debugパネル非表示: POIにフルに使わせる
    const poiPanelWidth = calcPOIPanelWidth(viewportWidth, 0, canvasWidth);
    return { debugPanelWidth: DEBUG_PANEL_MAX, poiPanelWidth };
  }

  const poiActual = poiPanelOpen ? POI_PANEL_MIN : COLLAPSED_STRIP_WIDTH;

  if (budget >= DEBUG_PANEL_MAX + poiActual) {
    // debugがMAXに到達できる → MAXを予約してPOIを算出
    const poiPanelWidth = calcPOIPanelWidth(viewportWidth, DEBUG_PANEL_MAX, canvasWidth);
    return { debugPanelWidth: DEBUG_PANEL_MAX, poiPanelWidth };
  }

  // debugがMAXに届かない → POIにMINを予約して残りをdebugへ
  const poiReserved = poiPanelOpen ? POI_PANEL_MIN : COLLAPSED_STRIP_WIDTH;
  const debugPanelWidth = Math.max(
    DEBUG_PANEL_MIN,
    Math.min(DEBUG_PANEL_MAX, budget - poiReserved),
  );
  const poiPanelWidth = calcPOIPanelWidth(viewportWidth, debugPanelWidth, canvasWidth);
  return { debugPanelWidth, poiPanelWidth };
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
  const isDebugMode = useStoreValue("isDebugMode");
  const poiPanelOpen = useStoreValue("poiPanelOpen");
  const maxCanvasSize = useStoreValue("maxCanvasSize");

  const canvasWidth = maxCanvasSize === -1 ? 1024 : Math.min(maxCanvasSize, viewportWidth);
  const { debugPanelWidth, poiPanelWidth } = calcPanelWidths(
    viewportWidth,
    isDebugMode,
    canvasWidth,
    poiPanelOpen,
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

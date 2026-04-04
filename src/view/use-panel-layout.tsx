import { useStoreValue } from "@/store/store";
import { useEffect, useState } from "react";
import { useIsWideViewport } from "./debug-panel/use-is-wide-viewport";

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
        // throttle間隔内でも最後の値を拾うための遅延更新
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
 * - 4列: 760px
 * - 3列: 580px
 * - 2列: 400px
 */
const usePOIPanelWidthValue = (debugPanelWidth: number, viewportWidth: number): number => {
  const isDebugMode = useStoreValue("isDebugMode");
  const maxCanvasSize = useStoreValue("maxCanvasSize");

  const canvasWidth = maxCanvasSize === -1 ? 1024 : Math.min(maxCanvasSize, viewportWidth);
  const activeDebugWidth = isDebugMode ? debugPanelWidth : 0;

  // パネル幅にした場合、キャンバス左右に100pxずつ(計200px)余白が残るなら切り替える
  const canFit = (poiWidth: number) =>
    viewportWidth >= activeDebugWidth + poiWidth + canvasWidth + 200;

  if (canFit(1120)) return 1120;
  if (canFit(940)) return 940;
  if (canFit(760)) return 760;
  if (canFit(580)) return 580;
  return 400;
};

/**
 * パネルレイアウト情報を一括で返すフック
 *
 * デバッグパネル幅、POIパネル幅を提供する。
 * app-root.tsx, debug-panel, poi-panelの全てがこのフックを参照することで
 * パネル幅計算を一箇所に集約する。
 */
export const usePanelLayout = () => {
  const viewportWidth = useViewportWidth();
  const debugPanelWidth = useDebugPanelWidthValue();
  const poiPanelWidth = usePOIPanelWidthValue(debugPanelWidth, viewportWidth);

  return { debugPanelWidth, poiPanelWidth };
};

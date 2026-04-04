import { I18nProvider } from "@/i18n/context";
import { Toaster } from "@/shadcn/components/ui/toaster";
import { TooltipProvider } from "@/shadcn/components/ui/tooltip";
import { useStoreValue } from "@/store/store";
import { useEffect } from "react";
import ReactDOM from "react-dom";
import { CanvasOverlay } from "./canvas-overlay";
import { DebugPanel } from "./debug-panel";
import { COLLAPSED_STRIP_WIDTH, POIPanel } from "./poi-panel";
import { ProgressBar } from "./progress-bar";
import { SupersamplingOverlay } from "./supersampling-overlay";
import { Toolbar } from "./toolbar";
import { usePanelLayout } from "./use-panel-layout";

/**
 * パネルの開閉に応じてキャンバスの中央位置を調整する
 *
 * canvas-wrapperのleft/rightをパネル幅分ずらして、
 * キャンバスが両パネルの間の中央に来るようにする。
 */
const useCanvasPositionAdjust = () => {
  const isDebugMode = useStoreValue("isDebugMode");
  const poiPanelOpen = useStoreValue("poiPanelOpen");
  const { debugPanelWidth, poiPanelWidth } = usePanelLayout();

  useEffect(() => {
    const wrapper = document.getElementById("canvas-wrapper");
    if (!wrapper) return;

    const debugWidth = isDebugMode ? debugPanelWidth : 0;
    const poiWidth = poiPanelOpen ? poiPanelWidth : COLLAPSED_STRIP_WIDTH;

    wrapper.style.left = `${debugWidth}px`;
    wrapper.style.right = `${poiWidth}px`;
    wrapper.style.transition = "left 300ms, right 300ms";
  }, [isDebugMode, poiPanelOpen, debugPanelWidth, poiPanelWidth]);
};

export const AppRoot = () => {
  const locale = useStoreValue("locale");

  useCanvasPositionAdjust();

  return (
    <I18nProvider locale={locale}>
      <TooltipProvider delayDuration={0}>
        {ReactDOM.createPortal(<Toolbar />, document.getElementById("toolbar")!)}
        {ReactDOM.createPortal(<DebugPanel />, document.getElementById("debug-panel")!)}
        {ReactDOM.createPortal(<POIPanel />, document.getElementById("poi-panel")!)}
        {ReactDOM.createPortal(<ProgressBar />, document.getElementById("progress-bar")!)}
        {ReactDOM.createPortal(<CanvasOverlay />, document.getElementById("canvas-overlay")!)}
        {ReactDOM.createPortal(
          <SupersamplingOverlay />,
          document.getElementById("supersampling-overlay")!,
        )}
        <Toaster />
      </TooltipProvider>
    </I18nProvider>
  );
};

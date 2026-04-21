import { I18nProvider } from "@/i18n/context";
import { Toaster } from "@/shadcn/components/ui/sonner";
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
import { useIsMobile } from "./use-is-mobile";
import { PanelLayoutProvider, useExclusivePanels, usePanelLayout } from "./use-panel-layout";

/**
 * パネルの開閉に応じてキャンバスの中央位置を調整する
 *
 * canvas-wrapperのleft/rightをパネル幅分ずらして、
 * キャンバスが両パネルの間の中央に来るようにする。
 */
const useCanvasPositionAdjust = () => {
  const isDebugMode = useStoreValue("isDebugMode");
  const poiPanelOpen = useStoreValue("poiPanelOpen");
  const isMobile = useIsMobile();
  const { debugPanelWidth, poiPanelWidth } = usePanelLayout();

  useEffect(() => {
    const wrapper = document.getElementById("canvas-wrapper");
    if (!wrapper) return;

    // モバイルではデバッグパネル非表示・POIはBottomSheetで上に乗るためオフセット不要
    const debugWidth = !isMobile && isDebugMode ? debugPanelWidth : 0;
    const poiWidth = isMobile ? 0 : poiPanelOpen ? poiPanelWidth : COLLAPSED_STRIP_WIDTH;

    wrapper.style.left = `${debugWidth}px`;
    wrapper.style.right = `${poiWidth}px`;
  }, [isMobile, isDebugMode, poiPanelOpen, debugPanelWidth, poiPanelWidth]);
};

/** AppRoot内部（PanelLayoutProvider内で動作する） */
const AppRootInner = () => {
  const locale = useStoreValue("locale");

  useCanvasPositionAdjust();
  useExclusivePanels();

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
        <Toaster position="top-center" />
      </TooltipProvider>
    </I18nProvider>
  );
};

export const AppRoot = () => {
  return (
    <PanelLayoutProvider>
      <AppRootInner />
    </PanelLayoutProvider>
  );
};

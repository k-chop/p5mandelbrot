import { I18nProvider } from "@/i18n/context";
import { Toaster } from "@/shadcn/components/ui/toaster";
import { TooltipProvider } from "@/shadcn/components/ui/tooltip";
import { useStoreValue } from "@/store/store";
import { useEffect } from "react";
import ReactDOM from "react-dom";
import { CanvasOverlay } from "./canvas-overlay";
import { DebugPanel } from "./debug-panel";
import { useIsWideViewport } from "./debug-panel/use-is-wide-viewport";
import { POIPanel } from "./poi-panel";
import { ProgressBar } from "./progress-bar";
import { SupersamplingOverlay } from "./supersampling-overlay";
import { Toolbar } from "./toolbar";

/**
 * パネルの開閉に応じてキャンバスの中央位置を調整する
 *
 * パネルの幅を状態から計算し、canvas-wrapperにパディングを設定して
 * flexの中央配置でキャンバスが両パネルの間の中央に来るようにする。
 * windowResizedは無効化済みなので、パディング変更でresizeCanvasは走らない。
 */
const useCanvasPositionAdjust = () => {
  const isDebugMode = useStoreValue("isDebugMode");
  const poiPanelOpen = useStoreValue("poiPanelOpen");
  const isUltraWide = useIsWideViewport(2200);
  const isWide = useIsWideViewport(1800);

  useEffect(() => {
    const wrapper = document.getElementById("canvas-wrapper");
    if (!wrapper) return;

    // パネル幅を状態から計算（debug-panel/index.tsx, poi-panel/index.tsx と一致させる）
    const debugWidth = isDebugMode ? (isUltraWide ? 636 : isWide ? 500 : 436) : 0;
    const poiWidth = poiPanelOpen ? (isUltraWide ? 500 : 400) : 0;

    // inset: 0 を個別プロパティで上書きしてcanvas-wrapperの範囲を狭める
    wrapper.style.left = `${debugWidth}px`;
    wrapper.style.right = `${poiWidth}px`;
    wrapper.style.transition = "left 300ms, right 300ms";
  }, [isDebugMode, poiPanelOpen, isUltraWide, isWide]);
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

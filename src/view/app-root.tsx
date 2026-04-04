import { I18nProvider } from "@/i18n/context";
import { Toaster } from "@/shadcn/components/ui/toaster";
import { TooltipProvider } from "@/shadcn/components/ui/tooltip";
import { useStoreValue } from "@/store/store";
import ReactDOM from "react-dom";
import { CanvasOverlay } from "./canvas-overlay";
import { POIPanel } from "./poi-panel";
import { ProgressBar } from "./progress-bar";
import { SupersamplingOverlay } from "./supersampling-overlay";
import { Toolbar } from "./toolbar";

export const AppRoot = () => {
  const locale = useStoreValue("locale");

  return (
    <I18nProvider locale={locale}>
      <TooltipProvider delayDuration={0}>
        {ReactDOM.createPortal(<Toolbar />, document.getElementById("toolbar")!)}
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

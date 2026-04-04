import { useT } from "@/i18n/context";
import { cloneCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { Separator } from "@/shadcn/components/ui/separator";
import { updateStore, updateStoreWith, useStoreValue } from "@/store/store";
import { isGithubPages } from "@/utils/location";
import { IconCirclePlus, IconLayoutSidebar, IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import { useIsWideViewport } from "../debug-panel/use-is-wide-viewport";
import { POI } from "../right-sidebar/poi";
import { POICardPreview } from "../right-sidebar/poi-card-preview";
import { POIHistories } from "../right-sidebar/poi-histories";
import { usePOI } from "../right-sidebar/use-poi";
import { usePanelLayout } from "../use-panel-layout";

/** POIパネル閉じ時のストリップ幅(px) */
export const COLLAPSED_STRIP_WIDTH = 80;

/** 狭い画面での排他ロジック: POIパネル開時にデバッグを閉じる */
const useExclusivePanels = () => {
  const poiPanelOpen = useStoreValue("poiPanelOpen");
  const isNarrow = !useIsWideViewport(1440);

  useEffect(() => {
    if (isNarrow && poiPanelOpen) {
      updateStore("isDebugMode", false);
    }
  }, [isNarrow, poiPanelOpen]);
};

/** POIパネル内のコンテンツ */
const PanelContent = () => {
  if (isGithubPages()) {
    return <SuggestRedirect />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex grow flex-col">
        <POI />
      </div>
      <POIHistories />
    </div>
  );
};

/** GitHub Pages用のリダイレクト案内 */
const SuggestRedirect = () => {
  const t = useT();

  return (
    <div className="px-3">
      <div className="text-lg font-bold">{t("This is outdated app.")}</div>
      <div className="py-2">
        {t("Please visit ", "operations.visitNewAppBefore")}
        <a href="https://p5mandelbrot.pages.dev" className="text-primary hover:underline">
          https://p5mandelbrot.pages.dev
        </a>
        {t(" to use new app.", "operations.visitNewAppAfter")}
      </div>
    </div>
  );
};

/** 閉じた時に右端に表示されるミニPOIストリップ */
const CollapsedStrip = () => {
  const { poiList, addPOI, applyPOI } = usePOI();

  return (
    <div className="absolute top-0 left-0 h-full w-20 overflow-y-scroll border-r border-[#3a3a4a] bg-[#1e1e2e]">
      <div className="sticky top-0 z-10 flex flex-col items-center gap-1.5 bg-[#1e1e2e] px-1.5 pt-1.5 pb-2">
        <button
          onClick={() => updateStore("poiPanelOpen", true)}
          className="flex aspect-square w-full items-center justify-center rounded transition-colors hover:bg-[#262640]"
        >
          <IconLayoutSidebar size={20} className="text-foreground/60" />
        </button>
        <Separator className="w-full" />
        <button
          onClick={() => addPOI(cloneCurrentParams())}
          className="flex aspect-square w-full items-center justify-center rounded bg-primary/90 transition-colors hover:bg-primary"
        >
          <IconCirclePlus size={20} className="text-primary-foreground" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-1.5 px-1.5 pb-2">
        {poiList.map((poi) => (
          <button
            key={poi.id}
            onClick={() => applyPOI(poi)}
            className="w-full shrink-0 overflow-hidden rounded transition-opacity hover:opacity-80"
          >
            <POICardPreview poi={poi} />
          </button>
        ))}
      </div>
    </div>
  );
};

/** 右側スライドインPOIパネル */
export const POIPanel = () => {
  const poiPanelOpen = useStoreValue("poiPanelOpen");
  const { poiPanelWidth } = usePanelLayout();

  useExclusivePanels();

  return (
    <div
      style={{
        width: `${poiPanelWidth}px`,
        transform: poiPanelOpen
          ? "translateX(0)"
          : `translateX(calc(100% - ${COLLAPSED_STRIP_WIDTH}px))`,
      }}
      className={`fixed top-0 right-0 z-90 flex h-full flex-col border-l border-[#2a2a3a] transition-transform duration-300 ${
        poiPanelOpen ? "bg-[#161620]/97 shadow-[-4px_0_16px_rgba(0,0,0,0.5)] backdrop-blur-sm" : ""
      }`}
    >
      {poiPanelOpen ? (
        <>
          <div className="flex items-center justify-between border-b border-[#2a2a3a] px-4 py-3">
            <h2 className="text-sm font-semibold">Points of Interest</h2>
            <button
              onClick={() => updateStoreWith("poiPanelOpen", (v) => !v)}
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            >
              <IconX size={18} />
            </button>
          </div>
          <div className="flex min-h-0 grow flex-col overflow-y-auto px-2 pt-2">
            <PanelContent />
          </div>
        </>
      ) : (
        <CollapsedStrip />
      )}
    </div>
  );
};

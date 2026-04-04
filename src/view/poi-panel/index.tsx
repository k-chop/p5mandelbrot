import { useT } from "@/i18n/context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shadcn/components/ui/tabs";
import { updateStoreWith, useStoreValue } from "@/store/store";
import { isGithubPages } from "@/utils/location";
import { IconX } from "@tabler/icons-react";
import { DebugMode } from "../right-sidebar/debug-mode/debug-mode";
import { PaletteEditor } from "../right-sidebar/palette-editor";
import { POI } from "../right-sidebar/poi";
import { POIHistories } from "../right-sidebar/poi-histories";
import { Settings } from "../right-sidebar/settings";

const tabsContentClass = "flex h-full grow flex-col data-[state=inactive]:hidden";

/** POIパネル内のタブコンテンツ（Phase1: 既存Operations + Debug統合） */
const PanelContent = () => {
  const t = useT();
  const isDebugMode = useStoreValue("isDebugMode");

  if (isGithubPages()) {
    return <SuggestRedirect />;
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs className="flex grow flex-col" defaultValue="poi">
        <TabsList className={`grid w-full ${isDebugMode ? "grid-cols-4" : "grid-cols-3"}`}>
          <TabsTrigger value="poi">POI</TabsTrigger>
          <TabsTrigger value="palette">{t("Palette", "operations.palette")}</TabsTrigger>
          <TabsTrigger value="settings">{t("Settings", "operations.settings")}</TabsTrigger>
          {isDebugMode && <TabsTrigger value="debug">Debug</TabsTrigger>}
        </TabsList>
        <TabsContent className={tabsContentClass} value="poi">
          <POI />
        </TabsContent>
        <TabsContent className={tabsContentClass} value="palette">
          <PaletteEditor />
        </TabsContent>
        <TabsContent className={tabsContentClass} value="settings">
          <Settings />
        </TabsContent>
        {isDebugMode && (
          <TabsContent className={tabsContentClass} value="debug">
            <DebugMode />
          </TabsContent>
        )}
      </Tabs>
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

/** 右側スライドインPOIパネル */
export const POIPanel = () => {
  const poiPanelOpen = useStoreValue("poiPanelOpen");

  return (
    <div
      className={`fixed top-0 right-0 z-[90] flex h-full w-[400px] flex-col border-l border-[#2a2a3a] bg-[#161620]/97 shadow-[-4px_0_16px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-transform duration-300 ${
        poiPanelOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
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
    </div>
  );
};

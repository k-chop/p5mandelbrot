import { useT } from "@/i18n/context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shadcn/components/ui/tabs";
import { isGithubPages } from "@/utils/location";
import { PaletteEditor } from "./palette-editor";
import { POI } from "./poi";
import { Settings } from "./settings";

const tabsContentClass = "flex h-full grow flex-col data-[state=inactive]:hidden";

export const Operations = () => {
  const t = useT();

  if (isGithubPages()) {
    return <SuggestRedirect />;
  }

  return (
    <Tabs className="mx-2 flex grow flex-col" defaultValue="poi">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="poi">POI</TabsTrigger>
        <TabsTrigger value="palette">{t("Palette", "operations.palette")}</TabsTrigger>
        <TabsTrigger value="settings">{t("Settings", "operations.settings")}</TabsTrigger>
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
    </Tabs>
  );
};

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

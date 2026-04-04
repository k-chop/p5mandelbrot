import { SimpleTooltip } from "@/components/simple-tooltip";
import { useT } from "@/i18n/context";
import { Button } from "@/shadcn/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { Label } from "@/shadcn/components/ui/label";
import { Switch } from "@/shadcn/components/ui/switch";
import { updateStore, updateStoreWith, useStoreValue } from "@/store/store";
import { IconHelp, IconLayoutSidebar } from "@tabler/icons-react";
import { Actions } from "../header/actions";
import { Instructions } from "../header/instructions";
import { useModalState } from "../modal/use-modal-state";

/** 言語切り替えボタン */
const LanguageToggle = () => {
  const t = useT();
  const locale = useStoreValue("locale");

  return (
    <SimpleTooltip content={t("Switch language")}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => updateStore("locale", locale === "en" ? "ja" : "en")}
      >
        {locale === "en" ? "JA" : "EN"}
      </Button>
    </SimpleTooltip>
  );
};

/** POIパネルの開閉トグルボタン */
const POIPanelToggle = () => {
  const t = useT();
  const poiPanelOpen = useStoreValue("poiPanelOpen");

  return (
    <SimpleTooltip content={t("Toggle POI panel", "toolbar.togglePOIPanel")}>
      <Button
        variant={poiPanelOpen ? "default" : "outline"}
        size="sm"
        onClick={() => updateStoreWith("poiPanelOpen", (v) => !v)}
      >
        <IconLayoutSidebar className="mr-1 size-5" />
        POI
      </Button>
    </SimpleTooltip>
  );
};

/** フローティングツールバー（左上固定） */
export const Toolbar = () => {
  const t = useT();
  const [opened, { open, toggle }] = useModalState();
  const isDebugMode = useStoreValue("isDebugMode");

  const toggleDebugMode = () => updateStoreWith("isDebugMode", (v) => !v);

  return (
    <>
      <Dialog open={opened} onOpenChange={toggle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-3xl">{t("Instructions")}</DialogTitle>
          </DialogHeader>
          <Instructions />
        </DialogContent>
      </Dialog>
      <div className="fixed top-3 left-3 z-[100] flex items-center gap-2 rounded-xl border border-[#2a2a3a] bg-[#1c1c24]/95 px-3 py-2 backdrop-blur-sm">
        <Actions />
        <div className="bg-border mx-1 h-6 w-px" />
        <LanguageToggle />
        <SimpleTooltip content={t("Shows debug data obtained from rendering results.")}>
          <div className="flex items-center space-x-2">
            <Switch
              id="debug-mode"
              checked={isDebugMode}
              onCheckedChange={() => toggleDebugMode()}
            />
            <Label htmlFor="debug-mode" className="text-xs">
              {t("Debug Mode")}
            </Label>
          </div>
        </SimpleTooltip>
        <Button variant="outline" size="icon-sm" asChild>
          <a href="https://github.com/k-chop/p5mandelbrot" target="_blank" rel="noreferrer">
            <img src="github-mark-white.svg" className="p-1" />
          </a>
        </Button>
        <Button variant="outline" size="icon-sm" onClick={open}>
          <IconHelp />
        </Button>
        <div className="bg-border mx-1 h-6 w-px" />
        <POIPanelToggle />
      </div>
    </>
  );
};

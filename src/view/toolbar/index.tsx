import { SimpleTooltip } from "@/components/simple-tooltip";
import { useT } from "@/i18n/context";
import { Button } from "@/shadcn/components/ui/button";
import { updateStoreWith, useStoreValue } from "@/store/store";
import { IconLayoutSidebar, IconSettings } from "@tabler/icons-react";
import { Actions } from "../header/actions";
import { useModalState } from "../modal/use-modal-state";
import { PalettePopover } from "../palette-popover";
import { SettingsDialog } from "../settings-dialog";

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
  const [settingsOpened, { open: openSettings, close: closeSettings }] = useModalState();

  return (
    <>
      <SettingsDialog
        open={settingsOpened}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeSettings();
        }}
      />
      <div className="fixed top-3 left-3 z-[100] flex items-center gap-2 rounded-xl border border-[#2a2a3a] bg-[#1c1c24]/95 px-3 py-2 backdrop-blur-sm">
        <Actions />
        <div className="bg-border mx-1 h-6 w-px" />
        <PalettePopover />
        <Button variant="outline" size="sm" onClick={openSettings}>
          <IconSettings className="mr-1 size-5" />
          {t("Settings", "operations.settings")}
        </Button>
        <div className="bg-border mx-1 h-6 w-px" />
        <POIPanelToggle />
      </div>
    </>
  );
};

import { SimpleTooltip } from "@/components/simple-tooltip";
import { useT } from "@/i18n/context";
import { Button } from "@/shadcn/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shadcn/components/ui/dropdown";
import { updateStoreWith, useStoreValue } from "@/store/store";
import { SupersamplingDialog } from "@/view/supersampling-popover/dialog";
import { useIsMobile } from "@/view/use-is-mobile";
import {
  IconBug,
  IconDownload,
  IconLayoutSidebar,
  IconMaximize,
  IconMenu2,
  IconNavigation,
  IconSettings,
  IconShare,
} from "@tabler/icons-react";
import { Actions, performSaveImage, RandomJumpButton, ShareDialogHost } from "../header/actions";
import { useModalState } from "../modal/use-modal-state";
import { PalettePopover } from "../palette-popover";
import { SettingsDialog } from "../settings-dialog";
import { JumpDialog } from "./jump-dialog";

/** デバッグパネルの開閉トグルボタン */
const DebugPanelToggle = () => {
  const isDebugMode = useStoreValue("isDebugMode");

  return (
    <SimpleTooltip content="Debug">
      <Button
        variant={isDebugMode ? "default" : "outline"}
        size="sm"
        onClick={() => updateStoreWith("isDebugMode", (v) => !v)}
      >
        <IconBug className="mr-1 size-5" />
        Debug
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

type OpenHandlers = {
  openShare: () => void;
  openSS: () => void;
  openJump: () => void;
  openSettings: () => void;
};

/** デスクトップ幅のツールバー内容 (従来レイアウト) */
const DesktopToolbarBody = ({ openShare, openJump, openSettings }: OpenHandlers) => {
  const t = useT();
  return (
    <>
      <Actions onOpenShare={openShare} />
      <div className="bg-border mx-1 h-6 w-px" />
      <PalettePopover />
      <Button variant="outline" size="sm" onClick={openJump}>
        <IconNavigation className="mr-1 size-5" />
        {t("Jump", "toolbar.jump")}
      </Button>
      <Button variant="outline" size="sm" onClick={openSettings}>
        <IconSettings className="mr-1 size-5" />
        {t("Settings", "operations.settings")}
      </Button>
      <div className="bg-border mx-1 h-6 w-px" />
      <DebugPanelToggle />
      <POIPanelToggle />
    </>
  );
};

/** モバイル幅のツールバー内容 (Lucky/Palette/POI独立 + ハンバーガー) */
const MobileToolbarBody = ({ openShare, openSS, openJump, openSettings }: OpenHandlers) => {
  const t = useT();

  return (
    <>
      <RandomJumpButton />
      <PalettePopover />
      <POIPanelToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Menu">
            <IconMenu2 className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="min-w-48">
          <DropdownMenuItem onSelect={openShare}>
            <IconShare className="size-4" />
            {t("Share", "header.share")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => performSaveImage(t)}>
            <IconDownload className="size-4" />
            {t("Save Image")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openSS}>
            <IconMaximize className="size-4" />
            {t("Supersampling x2", "header.supersamplingX2")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openJump}>
            <IconNavigation className="size-4" />
            {t("Jump", "toolbar.jump")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openSettings}>
            <IconSettings className="size-4" />
            {t("Settings", "operations.settings")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

/** フローティングツールバー (左上固定) */
export const Toolbar = () => {
  const isMobile = useIsMobile();
  const [shareOpened, { open: openShare, close: closeShare }] = useModalState();
  const [ssOpened, { open: openSS, close: closeSS }] = useModalState();
  const [jumpOpened, { open: openJump, close: closeJump }] = useModalState();
  const [settingsOpened, { open: openSettings, close: closeSettings }] = useModalState();

  const openHandlers: OpenHandlers = {
    openShare,
    openSS,
    openJump,
    openSettings,
  };

  return (
    <>
      <ShareDialogHost
        open={shareOpened}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeShare();
        }}
      />
      <SupersamplingDialog
        open={ssOpened}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeSS();
        }}
      />
      <SettingsDialog
        open={settingsOpened}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeSettings();
        }}
      />
      <JumpDialog
        open={jumpOpened}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeJump();
        }}
      />
      <div className="fixed top-3 left-3 z-100 flex items-center gap-2 rounded-xl border border-[#2a2a3a] bg-[#1c1c24]/95 px-3 py-2 backdrop-blur-sm">
        {isMobile ? (
          <MobileToolbarBody {...openHandlers} />
        ) : (
          <DesktopToolbarBody {...openHandlers} />
        )}
      </div>
    </>
  );
};

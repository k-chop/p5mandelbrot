import { useT } from "@/i18n/context";
import { Button } from "@/shadcn/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shadcn/components/ui/dropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/components/ui/popover";
import { updateStore, useStoreValue } from "@/store/store";
import {
  IconDice,
  IconDownload,
  IconLayoutSidebar,
  IconMaximize,
  IconMenu2,
  IconNavigation,
  IconPalette,
  IconSettings,
  IconShare,
} from "@tabler/icons-react";
import { performRandomJump, performSaveImage } from "../header/actions";
import { PaletteEditor } from "../right-sidebar/palette-editor";

/** モバイル用の丸型フローティングアイコンボタンの共通クラス */
const FLOATING_BUTTON_CLASS =
  "size-16 rounded-full border-[#2a2a3a] bg-[#1c1c24]/95 shadow-[0_4px_12px_rgba(0,0,0,0.4)] backdrop-blur-sm";

type MobileToolbarProps = {
  openShare: () => void;
  openSS: () => void;
  openJump: () => void;
  openSettings: () => void;
};

/**
 * fade用の透明度クラスを返す
 *
 * @param hidden - trueならフェードアウト + 操作不可に
 */
const fadeClass = (hidden: boolean): string =>
  hidden ? "pointer-events-none opacity-0" : "opacity-100";

/** 左上: ハンバーガーメニュー (Share/Save/SS/Jump/Settings) */
const HamburgerMenu = ({ openShare, openSS, openJump, openSettings }: MobileToolbarProps) => {
  const t = useT();
  const snap = useStoreValue("poiDrawerSnap");
  const hidden = snap === "full";

  return (
    <div
      className={`fixed top-3 left-3 z-100 transition-opacity duration-200 ${fadeClass(hidden)}`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Menu" className={FLOATING_BUTTON_CLASS}>
            <IconMenu2 className="size-8" />
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
    </div>
  );
};

/** 右上: I'm Feeling Lucky + Palette (縦並び、上からLucky→Palette) */
const TopRightActions = () => {
  const snap = useStoreValue("poiDrawerSnap");
  const hidden = snap === "full";

  return (
    <div
      className={`fixed top-3 right-3 z-100 flex flex-col gap-5 transition-opacity duration-200 ${fadeClass(hidden)}`}
    >
      <Button
        variant="default"
        size="icon"
        aria-label="I'm Feeling Lucky"
        className="size-16 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
        onClick={performRandomJump}
      >
        <IconDice className="size-8" />
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Palette"
            className={FLOATING_BUTTON_CLASS}
          >
            <IconPalette className="size-8" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-84 border border-[#2a2a3a] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          align="end"
          sideOffset={8}
        >
          <PaletteEditor />
        </PopoverContent>
      </Popover>
    </div>
  );
};

/**
 * 右下: POIドロワーを開くボタン
 *
 * closed状態のときだけ表示。タップするとsmall状態に遷移する。
 */
const POIToggleFab = () => {
  const snap = useStoreValue("poiDrawerSnap");
  const hidden = snap !== "closed";

  return (
    <div
      className={`fixed right-3 bottom-7 z-100 transition-opacity duration-200 ${fadeClass(hidden)}`}
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Open POI drawer"
        className={FLOATING_BUTTON_CLASS}
        onClick={() => updateStore("poiDrawerSnap", "small")}
      >
        <IconLayoutSidebar className="size-8" />
      </Button>
    </div>
  );
};

/**
 * モバイル向けツールバー (丸型アイコンボタンを画面各所に配置)
 *
 * 左上: ハンバーガー / 右上: Lucky + Palette / 右下: POIドロワー展開
 */
export const MobileToolbar = (props: MobileToolbarProps) => {
  return (
    <>
      <HamburgerMenu {...props} />
      <TopRightActions />
      <POIToggleFab />
    </>
  );
};

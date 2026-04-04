import { useT } from "@/i18n/context";
import { Button } from "@/shadcn/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/components/ui/popover";
import { IconPalette } from "@tabler/icons-react";
import { PaletteEditor } from "../right-sidebar/palette-editor";

/** ツールバーから開くパレットポップオーバー */
export const PalettePopover = () => {
  const t = useT();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <IconPalette className="mr-1 size-5" />
          {t("Palette", "operations.palette")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-84 border border-[#2a2a3a] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        align="start"
        sideOffset={8}
      >
        <PaletteEditor />
      </PopoverContent>
    </Popover>
  );
};

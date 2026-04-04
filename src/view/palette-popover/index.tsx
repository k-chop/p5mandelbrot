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
      <PopoverContent className="w-80" align="start" sideOffset={8}>
        <PaletteEditor />
      </PopoverContent>
    </Popover>
  );
};

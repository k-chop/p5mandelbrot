import { useT } from "@/i18n/context";
import { Button } from "@/shadcn/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/components/ui/popover";
import { Expand } from "lucide-react";
import { SupersamplingForm } from "./form";

/** スーパーサンプリング設定ポップオーバー (デスクトップ用) */
export const SupersamplingPopover = () => {
  const t = useT();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Expand className="mr-1 size-5" />
          {t("Supersampling x2", "header.supersamplingX2")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 border border-[#2a2a3a] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        align="start"
        sideOffset={8}
      >
        <SupersamplingForm />
      </PopoverContent>
    </Popover>
  );
};

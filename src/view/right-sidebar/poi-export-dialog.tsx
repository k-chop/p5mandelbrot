import { useT } from "@/i18n/context";
import { Button } from "@/shadcn/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { Textarea } from "@/shadcn/components/ui/textarea";
import { toast } from "sonner";
import { serializePOIListToText } from "@/store/sync-storage/poi-list";
import { useStoreValue } from "@/store/store";
import { ClickFeedback, useClickFeedback } from "@/view/components/click-feedback";
import { IconCircleCheck, IconCopy } from "@tabler/icons-react";
import type { POIData } from "../../types";

type POIExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * POIリストをplain textでエクスポートするダイアログ
 */
export const POIExportDialog = ({ open, onOpenChange }: POIExportDialogProps) => {
  const t = useT();
  const poiList: POIData[] = useStoreValue("poi");
  const copyFeedback = useClickFeedback();

  if (!open) return null;

  const text = serializePOIListToText(poiList);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      copyFeedback.trigger();
    } catch {
      toast.error(t("Failed to copy to clipboard", "share.copyFailed"), { duration: 3000 });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Export POI", "poi.exportTitle")}</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          {t("{count} POIs", "poi.exportCount").replace("{count}", poiList.length.toString())}
        </div>

        <Textarea readOnly value={text} className="max-h-80 font-mono text-xs" />

        <ClickFeedback
          open={copyFeedback.open}
          content={
            <div className="flex items-center gap-1">
              <IconCircleCheck className="size-4" />
              {t("Copied!", "share.copied")}
            </div>
          }
        >
          <Button variant="default" className="w-full" onClick={handleCopy}>
            <IconCopy className="mr-2 size-4" />
            {t("Copy to clipboard", "poi.copyToClipboard")}
          </Button>
        </ClickFeedback>
      </DialogContent>
    </Dialog>
  );
};

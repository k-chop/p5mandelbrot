import { useT } from "@/i18n/context";
import { Button } from "@/shadcn/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { Textarea } from "@/shadcn/components/ui/textarea";
import {
  deserializePOIListFromText,
  mergePOIList,
  writePOIListToStorage,
} from "@/store/sync-storage/poi-list";
import { updateStore, useStoreValue } from "@/store/store";
import { IconDownload } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { POIData } from "../../types";

type POIImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * POIリストをplain textからインポートするダイアログ
 */
export const POIImportDialog = ({ open, onOpenChange }: POIImportDialogProps) => {
  const t = useT();
  const poiList: POIData[] = useStoreValue("poi");
  const [input, setInput] = useState("");

  const preview = useMemo(() => {
    if (!input.trim()) return null;
    const parsed = deserializePOIListFromText(input);
    if (parsed.length === 0) return null;
    const { newCount, duplicateCount } = mergePOIList(poiList, parsed);
    return { totalParsed: parsed.length, newCount, duplicateCount };
  }, [input, poiList]);

  const handleImport = () => {
    if (!preview || preview.newCount === 0) return;
    const parsed = deserializePOIListFromText(input);
    const { result } = mergePOIList(poiList, parsed);
    writePOIListToStorage(result);
    updateStore("poi", result);
    setInput("");
    onOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setInput("");
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Import POI", "poi.importTitle")}</DialogTitle>
        </DialogHeader>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("Paste exported POI text here...", "poi.pasteHere")}
          className="max-h-80 font-mono text-xs"
        />

        {preview && (
          <div className="text-sm">
            <span>
              {t("{count} POIs parsed", "poi.importParsed").replace(
                "{count}",
                preview.totalParsed.toString(),
              )}
            </span>
            {" — "}
            <span className="font-medium text-primary">
              {t("{count} new", "poi.importNew").replace("{count}", preview.newCount.toString())}
            </span>
            {preview.duplicateCount > 0 && (
              <span className="text-muted-foreground">
                {", "}
                {t("{count} duplicates ignored", "poi.importDuplicates").replace(
                  "{count}",
                  preview.duplicateCount.toString(),
                )}
              </span>
            )}
          </div>
        )}

        <Button
          variant="default"
          className="w-full"
          disabled={!preview || preview.newCount === 0}
          onClick={handleImport}
        >
          <IconDownload className="mr-2 size-4" />
          {preview && preview.newCount > 0
            ? t("Import {count} POIs", "poi.importButton").replace(
                "{count}",
                preview.newCount.toString(),
              )
            : t("Import", "poi.import")}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

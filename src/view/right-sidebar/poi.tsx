import { useT } from "@/i18n/context";
import { cloneCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { Alert, AlertDescription } from "@/shadcn/components/ui/alert";
import { Button } from "@/shadcn/components/ui/button";
import { loadPreview, savePreview } from "@/store/preview-store";
import type { POIData } from "@/types";
import { useModalState } from "@/view/modal/use-modal-state";
import {
  type ThumbnailTarget,
  useThumbnailBatch,
} from "@/view/thumbnail-batch/use-thumbnail-batch";
import { IconCirclePlus, IconDownload, IconPhoto, IconUpload } from "@tabler/icons-react";
import throttle from "lodash.throttle";
import { useCallback, useEffect, useRef, useState } from "react";
import { POICard } from "./poi-card";
import { POIExportDialog } from "./poi-export-dialog";
import { POIImportDialog } from "./poi-import-dialog";
import { usePOI } from "./use-poi";

/** POIDataをThumbnailTargetに変換する */
const toThumbnailTarget = (poi: POIData): ThumbnailTarget => ({
  id: poi.id,
  x: poi.x.toString(),
  y: poi.y.toString(),
  r: poi.r.toString(),
  N: poi.N,
  mode: poi.mode,
  palette: poi.serializedPalette,
});

export const POI = () => {
  const t = useT();
  const { poiList, addPOI, deletePOIAt, applyPOI, regenerateThumbnailPOI } = usePOI();
  const scrollTop = useRef(parseInt(sessionStorage.getItem("scroll") ?? "0"));
  const viewportRef = useRef<HTMLDivElement>(null);
  const [exportOpened, { open: openExport, close: closeExport }] = useModalState();
  const [importOpened, { open: openImport, close: closeImport }] = useModalState();

  const handleCapture = useCallback(async (id: string, dataUrl: string) => {
    savePreview(id, dataUrl);
  }, []);

  const { batchState, start: startBatch } = useThumbnailBatch(handleCapture);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleGenerateMissing = async () => {
    setFeedback(null);
    const missing: ThumbnailTarget[] = [];
    for (const poi of poiList) {
      const preview = await loadPreview(poi.id);
      if (!preview) {
        missing.push(toThumbnailTarget(poi));
      }
    }

    if (missing.length === 0) {
      setFeedback("All thumbnails already exist");
      return;
    }

    setFeedback(`Generating ${missing.length} thumbnails...`);
    startBatch(missing);
  };

  const handleScroll = throttle((e: React.UIEvent<HTMLDivElement>) => {
    scrollTop.current = e.currentTarget.scrollTop;
  }, 500);

  useEffect(() => {
    const scroll = scrollTop.current;
    if (viewportRef.current) {
      viewportRef.current.scrollTop = scroll;
    }

    return () => {
      sessionStorage.setItem("scroll", scrollTop.current.toString());
    };
  }, []);

  const isRunning = batchState.status === "running";

  return (
    <>
      <div className="flex-none">
        <div className="mb-2 flex gap-2 justify-between">
          <div className="flex w-64">
            <Button
              variant="default"
              size="sm"
              className="grow"
              onClick={() => addPOI(cloneCurrentParams())}
            >
              <IconCirclePlus className="mr-1 size-5" />
              {t("Save POI")}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateMissing}
              disabled={isRunning}
              title="Generate missing thumbnails"
            >
              <IconPhoto className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={openExport}>
              <IconUpload className="mr-1 size-4" />
              {t("Export", "poi.export")}
            </Button>
            <Button variant="outline" size="sm" onClick={openImport}>
              <IconDownload className="mr-1 size-4" />
              {t("Import", "poi.import")}
            </Button>
          </div>
        </div>
        {isRunning && (
          <Alert className="mb-2">
            <AlertDescription>
              Generating... {batchState.current}/{batchState.total}
            </AlertDescription>
          </Alert>
        )}
        {batchState.status === "done" && batchState.generated > 0 && (
          <Alert className="mb-2">
            <AlertDescription>Done! {batchState.generated} thumbnails generated</AlertDescription>
          </Alert>
        )}
        {feedback && !isRunning && batchState.status !== "done" && (
          <Alert className="mb-2">
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}
      </div>

      <POIExportDialog
        open={exportOpened}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeExport();
        }}
      />
      <POIImportDialog
        open={importOpened}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeImport();
        }}
      />

      <div
        ref={viewportRef}
        className="min-h-10 grow basis-0 overflow-y-scroll"
        onScroll={handleScroll}
      >
        <div
          className="grid gap-2 p-1 pr-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}
        >
          {poiList.map((poi, index) => (
            <POICard
              key={poi.id}
              poi={poi}
              onDelete={() => deletePOIAt(index)}
              onApply={() => applyPOI(poi)}
              onRegenerateThumbnail={() => regenerateThumbnailPOI(index)}
            />
          ))}
        </div>
      </div>
    </>
  );
};

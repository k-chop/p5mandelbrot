import { useT } from "@/i18n/context";
import { cloneCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { Button } from "@/shadcn/components/ui/button";
import { ScrollArea } from "@/shadcn/components/ui/scroll-area";
import { useModalState } from "@/view/modal/use-modal-state";
import { IconCirclePlus, IconDownload, IconUpload } from "@tabler/icons-react";
import throttle from "lodash.throttle";
import { useEffect, useRef } from "react";
import { POICard } from "./poi-card";
import { POIExportDialog } from "./poi-export-dialog";
import { POIImportDialog } from "./poi-import-dialog";
import { usePOI } from "./use-poi";

export const POI = () => {
  const t = useT();
  const { poiList, addPOI, deletePOIAt, applyPOI, regenerateThumbnailPOI } = usePOI();
  const scrollTop = useRef(parseInt(sessionStorage.getItem("scroll") ?? "0"));
  const viewportRef = useRef<HTMLDivElement>(null);
  const [exportOpened, { open: openExport, close: closeExport }] = useModalState();
  const [importOpened, { open: openImport, close: closeImport }] = useModalState();

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

      <ScrollArea
        ref={viewportRef}
        className="flex min-h-10 grow basis-0 flex-col overflow-y-auto"
        onScroll={handleScroll}
      >
        <div>
          <div className="flex flex-row flex-wrap gap-2 pt-1 pl-1">
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
      </ScrollArea>
    </>
  );
};

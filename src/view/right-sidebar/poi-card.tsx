import { getCurrentPalette } from "@/camera/palette";
import { deserializePalette } from "@/color";
import { SimpleTooltip } from "@/components/simple-tooltip";
import { getCanvasSize } from "@/rendering/renderer";
import { Button } from "@/shadcn/components/ui/button";
import { Card } from "@/shadcn/components/ui/card";
import { loadPreview } from "@/store/preview-store";
import { useStoreValue } from "@/store/store";
import { buildShareData } from "@/utils/mandelbrot-url-params";
import { ShareDialog } from "@/view/header/share-dialog";
import { useModalState } from "@/view/modal/use-modal-state";
import { IconShare, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { POIData } from "../../types";
import { POICardPreview } from "./poi-card-preview";

type POICardProps = {
  poi: POIData;
  onDelete: () => void;
  onApply: () => void;
  onRegenerateThumbnail: () => void;
};

export const POICard = ({ poi, onDelete, onApply, onRegenerateThumbnail }: POICardProps) => {
  const { r, N } = poi;

  const isInSamePlace = useIsInSamePlace(poi);
  const [shareOpened, { open: openShare, close: closeShare }] = useModalState();
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (shareOpened) {
      void loadPreview(poi.id).then((data: string | undefined) => {
        setThumbnailDataUrl(data ?? null);
      });
    }
  }, [shareOpened, poi.id]);

  const shareData = shareOpened
    ? buildShareData({
        x: poi.x,
        y: poi.y,
        r: poi.r,
        N: poi.N,
        palette: poi.serializedPalette
          ? deserializePalette(poi.serializedPalette)
          : getCurrentPalette(),
        canvasWidth: getCanvasSize().width,
      })
    : { url: "", x: "", y: "", r: "", N: 0 };

  const overlayText = isInSamePlace ? "Regenerate thumbnail" : "Apply";
  const handleThumbnailClick = isInSamePlace ? onRegenerateThumbnail : onApply;

  return (
    <Card className={`p-2 ${isInSamePlace ? "ring-2 ring-primary/50" : ""}`}>
      <div className="flex">
        <div className="group relative size-25 cursor-pointer" onClick={handleThumbnailClick}>
          <POICardPreview poi={poi} />
          <div className="absolute inset-0 flex items-center justify-center rounded bg-black/70 text-xs text-center font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            {overlayText}
          </div>
        </div>
        <div className="ml-2 flex grow flex-col justify-between">
          <div>
            <div className="flex justify-between">
              <div className="mr-2">r</div>
              <div>{r.toPrecision(3)}</div>
            </div>
            <div className="flex justify-between">
              <div className="mr-2">N</div>
              <div>{N.toFixed(0)}</div>
            </div>
          </div>

          <div className="mt-2 flex justify-between gap-2">
            <SimpleTooltip content="Share">
              <Button variant="default" size="icon-sm" onClick={openShare}>
                <IconShare />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip content="Delete">
              <Button variant="destructive" size="icon-sm" onClick={onDelete}>
                <IconTrash />
              </Button>
            </SimpleTooltip>
          </div>
        </div>
      </div>
      <ShareDialog
        open={shareOpened}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeShare();
        }}
        shareData={shareData}
        imageDataUrl={thumbnailDataUrl}
        showCopyImage={false}
      />
    </Card>
  );
};

const useIsInSamePlace = (poi: POIData) => {
  const centerX = useStoreValue("centerX");
  const centerY = useStoreValue("centerY");
  const r = useStoreValue("r");
  const N = useStoreValue("N");
  const mode = useStoreValue("mode");

  return poi.x.eq(centerX) && poi.y.eq(centerY) && poi.r.eq(r) && poi.N === N && poi.mode === mode;
};

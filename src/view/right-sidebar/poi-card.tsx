import { getCurrentPalette } from "@/camera/palette";
import { deserializePalette } from "@/color";
import { SimpleTooltip } from "@/components/simple-tooltip";
import { useT } from "@/i18n/context";
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
  const t = useT();
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
      })
    : { url: "", x: "", y: "", r: "", N: 0 };

  const overlayText = isInSamePlace ? t("Regenerate thumbnail") : t("Apply", "poi.apply");
  const handleThumbnailClick = isInSamePlace ? onRegenerateThumbnail : onApply;

  return (
    <Card className={`overflow-hidden p-0 ${isInSamePlace ? "ring-2 ring-primary/50" : ""}`}>
      <div className="group relative cursor-pointer" onClick={handleThumbnailClick}>
        <POICardPreview poi={poi} />
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-center font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          {overlayText}
        </div>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5">
        <div className="min-w-0 text-xs">
          <span className="text-muted-foreground">r:</span>
          {r.toPrecision(3)} <span className="text-muted-foreground">N:</span>
          {N.toFixed(0)}
        </div>
        <div className="flex gap-1">
          <SimpleTooltip content={t("Share", "header.share")}>
            <Button variant="ghost" size="icon-sm" onClick={openShare}>
              <IconShare className="size-3.5" />
            </Button>
          </SimpleTooltip>
          <SimpleTooltip content={t("Delete", "poi.delete")}>
            <Button variant="ghost" size="icon-sm" onClick={onDelete}>
              <IconTrash className="size-3.5" />
            </Button>
          </SimpleTooltip>
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

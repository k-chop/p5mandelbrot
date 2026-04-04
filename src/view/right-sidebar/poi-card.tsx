import { getCurrentPalette } from "@/camera/palette";
import { deserializePalette } from "@/color";
import { SimpleTooltip } from "@/components/simple-tooltip";
import { useT } from "@/i18n/context";
import { Button } from "@/shadcn/components/ui/button";
import { Card } from "@/shadcn/components/ui/card";
import { toast } from "sonner";
import { loadPreview } from "@/store/preview-store";
import { useStoreValue } from "@/store/store";
import { isDevMode } from "@/utils/dev-mode";
import { buildShareData } from "@/utils/mandelbrot-url-params";
import { ShareDialog } from "@/view/header/share-dialog";
import { useModalState } from "@/view/modal/use-modal-state";
import { IconBookmarkPlus, IconShare, IconTrash } from "@tabler/icons-react";
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
          {isDevMode() && (
            <SimpleTooltip content="Add to Preset">
              <Button variant="ghost" size="icon-sm" onClick={() => addToPreset(poi)}>
                <IconBookmarkPlus className="size-3.5" />
              </Button>
            </SimpleTooltip>
          )}
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

/**
 * POIをプリセットリストに追加する
 *
 * サーバーAPIにPOIデータとサムネイルを送信する。dev-all時のみ使用。
 */
const addToPreset = async (poi: POIData) => {
  const thumbnail = await loadPreview(poi.id);

  const body = {
    x: poi.x.toString(),
    y: poi.y.toString(),
    r: poi.r.toString(),
    N: poi.N,
    mode: poi.mode,
    palette: poi.serializedPalette,
    thumbnail: thumbnail ?? undefined,
  };

  try {
    const res = await fetch("http://localhost:8080/api/preset-poi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    toast.success(`Added to preset: #${data.id}`, { duration: 2000 });
  } catch {
    toast.error("Failed to add to preset (is dev server running?)", { duration: 3000 });
  }
};

const useIsInSamePlace = (poi: POIData) => {
  const centerX = useStoreValue("centerX");
  const centerY = useStoreValue("centerY");
  const r = useStoreValue("r");
  const N = useStoreValue("N");
  const mode = useStoreValue("mode");

  return poi.x.eq(centerX) && poi.y.eq(centerY) && poi.r.eq(r) && poi.N === N && poi.mode === mode;
};

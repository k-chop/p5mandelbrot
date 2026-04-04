import { setSerializedPalette } from "@/camera/palette";
import { useT } from "@/i18n/context";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import { setCurrentParams, setManualN } from "@/mandelbrot-state/mandelbrot-state";
import {
  type PresetPOIRaw,
  getPresetPOIList,
  initializePresetPOIList,
} from "@/preset-poi/preset-poi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { toast } from "@/shadcn/hooks/use-toast";
import { isDevMode } from "@/utils/dev-mode";
import { IconTrash } from "@tabler/icons-react";
import BigNumber from "bignumber.js";
import { useState } from "react";

type PresetListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * プリセットPOI一覧を表示するダイアログ
 *
 * サムネイルがあればグリッド表示し、クリックでその座標にジャンプする。
 */
export const PresetListDialog = ({ open, onOpenChange }: PresetListDialogProps) => {
  const t = useT();
  const [revision, setRevision] = useState(0);
  // revisionの変更でリストを再取得する
  void revision;
  const presetList = getPresetPOIList();

  if (!open) return null;

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8080/api/preset-poi/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          description: `Deleted preset: #${data.deleted}`,
          variant: "primary",
          duration: 2000,
        });
        await initializePresetPOIList();
        setRevision((r) => r + 1);
      }
    } catch {
      toast({
        description: "Failed to delete preset (is dev server running?)",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("Preset List", "preset.title")}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          {t("{count} presets", "preset.count").replace("{count}", String(presetList.length))}
        </div>
        <div
          className="grid auto-rows-min gap-2 overflow-y-auto pr-1"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            maxHeight: "calc(80vh - 120px)",
          }}
        >
          {presetList.map((poi) => (
            <PresetCard
              key={poi.id}
              poi={poi}
              onJump={() => {
                jumpToPreset(poi);
                onOpenChange(false);
              }}
              onDelete={() => handleDelete(poi.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** プリセットPOIにジャンプする */
const jumpToPreset = (poi: PresetPOIRaw) => {
  setManualN(poi.N);
  setCurrentParams({
    x: new BigNumber(poi.x),
    y: new BigNumber(poi.y),
    r: new BigNumber(poi.r),
    N: poi.N,
    mode: poi.mode,
  });
  clearIterationCache();
  setSerializedPalette(poi.palette);
};

/** 個別プリセットのカード */
const PresetCard = ({
  poi,
  onJump,
  onDelete,
}: {
  poi: PresetPOIRaw;
  onJump: () => void;
  onDelete: () => void;
}) => {
  const base = import.meta.env.BASE_URL ?? "/";
  const thumbnailUrl = `${base}preset-poi/thumbnails/${poi.id}.png`;

  return (
    <div className="group overflow-hidden rounded border border-[#2a2a3a] bg-[#1e1e2e] transition-colors hover:border-primary/50">
      <button
        onClick={onJump}
        className="relative aspect-square w-full overflow-hidden bg-[#0a0a14]"
      >
        <img
          src={thumbnailUrl}
          alt={`Preset ${poi.id}`}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Jump
        </div>
      </button>
      <div className="flex items-center justify-between px-2 py-1 text-xs">
        <span>
          <span className="text-muted-foreground">#{poi.id}</span>{" "}
          <span className="text-muted-foreground">N:</span>
          {poi.N}
        </span>
        {isDevMode() && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-muted-foreground hover:text-destructive rounded p-0.5 transition-colors"
          >
            <IconTrash className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

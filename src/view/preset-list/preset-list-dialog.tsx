import { setSerializedPalette } from "@/camera/palette";
import { useT } from "@/i18n/context";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import { setCurrentParams, setManualN } from "@/mandelbrot-state/mandelbrot-state";
import { type PresetPOIRaw, getPresetPOIList } from "@/preset-poi/preset-poi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import BigNumber from "bignumber.js";

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
  const presetList = getPresetPOIList();

  if (!open) return null;

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
const PresetCard = ({ poi, onJump }: { poi: PresetPOIRaw; onJump: () => void }) => {
  const base = import.meta.env.BASE_URL ?? "/";
  const thumbnailUrl = `${base}preset-poi/thumbnails/${poi.id}.png`;

  return (
    <button
      onClick={onJump}
      className="group overflow-hidden rounded border border-[#2a2a3a] bg-[#1e1e2e] transition-colors hover:border-primary/50"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[#0a0a14]">
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
      </div>
      <div className="px-2 py-1 text-left text-xs">
        <span className="text-muted-foreground">#{poi.id}</span>{" "}
        <span className="text-muted-foreground">N:</span>
        {poi.N}
      </div>
    </button>
  );
};

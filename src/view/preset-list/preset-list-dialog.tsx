import { setSerializedPalette } from "@/camera/palette";
import { useT } from "@/i18n/context";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import { setCurrentParams, setManualN } from "@/mandelbrot-state/mandelbrot-state";
import {
  type PresetPOIRaw,
  getPresetPOIList,
  initializePresetPOIList,
} from "@/preset-poi/preset-poi";
import { Alert, AlertDescription } from "@/shadcn/components/ui/alert";
import { Button } from "@/shadcn/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { isDevMode } from "@/utils/dev-mode";
import {
  type ThumbnailTarget,
  useThumbnailBatch,
} from "@/view/thumbnail-batch/use-thumbnail-batch";
import { IconPhoto, IconTrash } from "@tabler/icons-react";
import BigNumber from "bignumber.js";
import { useCallback, useState } from "react";

type PresetListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * サムネイルが実際に存在するかcontent-typeで判定する
 *
 * Vite devサーバーはSPAフォールバックで存在しないファイルにも200を返すため、
 * ステータスコードだけでは判定できない。
 */
const thumbnailExists = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") ?? "";
    return contentType.startsWith("image/");
  } catch {
    return false;
  }
};

/**
 * プリセットPOI一覧を表示するダイアログ
 *
 * サムネイルがあればグリッド表示し、クリックでその座標にジャンプする。
 */
export const PresetListDialog = ({ open, onOpenChange }: PresetListDialogProps) => {
  const t = useT();
  const [revision, setRevision] = useState(0);
  void revision;
  const presetList = getPresetPOIList();
  const [feedback, setFeedback] = useState<{ type: "info" | "error"; message: string } | null>(
    null,
  );

  const handleCapture = useCallback(async (id: string, dataUrl: string) => {
    await fetch(`http://localhost:8080/api/preset-poi/${id}/thumbnail`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnail: dataUrl }),
    });
    setRevision((r) => r + 1);
  }, []);

  const { batchState, start: startBatch } = useThumbnailBatch(handleCapture);

  if (!open) return null;

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8080/api/preset-poi/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "info", message: `Deleted preset: #${data.deleted}` });
        await initializePresetPOIList();
        setRevision((r) => r + 1);
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to delete (is dev server running?)" });
    }
  };

  const handleGenerateThumbnails = async () => {
    setFeedback(null);
    const base = import.meta.env.BASE_URL ?? "/";
    const missing: ThumbnailTarget[] = [];

    for (const poi of presetList) {
      const url = `${base}preset-poi/thumbnails/${poi.id}.png`;
      const exists = await thumbnailExists(url);
      if (!exists) missing.push(poi);
    }

    if (missing.length === 0) {
      setFeedback({ type: "info", message: "All thumbnails already exist" });
      return;
    }

    setFeedback({ type: "info", message: `Generating ${missing.length} thumbnails...` });
    startBatch(missing);
  };

  const isRunning = batchState.status === "running";

  return (
    <Dialog open={open} onOpenChange={isRunning ? undefined : onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("Preset List", "preset.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t("{count} presets", "preset.count").replace("{count}", String(presetList.length))}
          </div>
          {isDevMode() && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateThumbnails}
              disabled={isRunning}
            >
              <IconPhoto className="mr-1 size-4" />
              Generate Thumbnails
            </Button>
          )}
        </div>
        {isRunning && (
          <Alert>
            <AlertDescription>
              Generating... {batchState.current}/{batchState.total} (#{batchState.currentId})
            </AlertDescription>
          </Alert>
        )}
        {batchState.status === "done" && batchState.generated > 0 && (
          <Alert>
            <AlertDescription>Done! {batchState.generated} thumbnails generated</AlertDescription>
          </Alert>
        )}
        {feedback && !isRunning && batchState.status !== "done" && (
          <Alert variant={feedback.type === "error" ? "destructive" : "default"}>
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        )}
        <div
          className="grid auto-rows-min gap-2 overflow-y-auto pr-1"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            maxHeight: "calc(80vh - 160px)",
          }}
        >
          {presetList.map((poi) => (
            <PresetCard
              key={poi.id}
              poi={poi}
              revision={revision}
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
  revision,
  onJump,
  onDelete,
}: {
  poi: PresetPOIRaw;
  revision: number;
  onJump: () => void;
  onDelete: () => void;
}) => {
  const base = import.meta.env.BASE_URL ?? "/";
  const thumbnailUrl = `${base}preset-poi/thumbnails/${poi.id}.png?v=${revision}`;

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

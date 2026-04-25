import { setSerializedPalette } from "@/camera/palette";
import { useT } from "@/i18n/context";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import { setCurrentParams, setManualN } from "@/mandelbrot-state/mandelbrot-state";
import {
  type PresetPOIRaw,
  getPresetDisplayLabel,
  getPresetThumbnailUrl,
  initializePresetPOIList,
  isGCSMode,
  setGCSMode,
  usePresetPOIList,
} from "@/preset-poi/preset-poi";
import { Alert, AlertDescription } from "@/shadcn/components/ui/alert";
import { Button } from "@/shadcn/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/ui/dialog";
import { updateStore } from "@/store/store";
import { isDevMode } from "@/utils/dev-mode";
import {
  type ThumbnailTarget,
  useThumbnailBatch,
} from "@/view/thumbnail-batch/use-thumbnail-batch";
import { IconCloud, IconFolder, IconPhoto, IconRefresh, IconTrash } from "@tabler/icons-react";
import BigNumber from "bignumber.js";
import { VisuallyHidden } from "radix-ui";
import { useCallback, useMemo, useRef, useState } from "react";

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
  const presetList = usePresetPOIList();
  const [feedback, setFeedback] = useState<{ type: "info" | "error"; message: string } | null>(
    null,
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = useRef(0);

  /** id降順で表示する（id文字列をparseInt、失敗時は文字列比較fallback） */
  const sortedPresetList = useMemo(() => {
    return [...presetList].sort((a, b) => {
      const aN = parseInt(a.id, 10);
      const bN = parseInt(b.id, 10);
      if (Number.isNaN(aN) || Number.isNaN(bN)) return b.id.localeCompare(a.id);
      return bN - aN;
    });
  }, [presetList]);

  /** ダイアログを閉じる際にscrollTopを退避し、必ずonOpenChange(false)経由で閉じる */
  const closeAndSaveScroll = useCallback(() => {
    savedScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
    onOpenChange(false);
  }, [onOpenChange]);

  /** Radix Dialog側からの開閉（ESC・外側クリック・×ボタン）でもscrollTopを退避 */
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        savedScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  /**
   * Radix DialogのContentはPortalマウントが遅延するため、useEffectでは
   * ref.currentがまだnullになる。ref callbackでattachされた瞬間にscrollTopを
   * 復元する形にして、確実にDOMが揃ってから書き込む。
   */
  const setScrollContainer = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    if (node) {
      node.scrollTop = savedScrollTopRef.current;
    }
  }, []);

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
    const missing: ThumbnailTarget[] = [];

    for (const poi of presetList) {
      const url = `http://localhost:8080/api/preset-poi/${poi.id}/thumbnail`;
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
    <Dialog open={open} onOpenChange={isRunning ? undefined : handleOpenChange}>
      <DialogContent className="max-h-[80dvh] max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t("Preset List", "preset.title")}</DialogTitle>
          <VisuallyHidden.Root>
            <DialogDescription>
              {t("Preset POI list", "dialog.description.presetList")}
            </DialogDescription>
          </VisuallyHidden.Root>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t("{count} presets", "preset.count").replace("{count}", String(presetList.length))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await initializePresetPOIList();
                setRevision((r) => r + 1);
              }}
              disabled={isRunning}
            >
              <IconRefresh className="mr-1 size-4" />
              Reload
            </Button>
            {isDevMode() && (
              <Button
                variant={isGCSMode() ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  setGCSMode(!isGCSMode());
                  await initializePresetPOIList();
                  setRevision((r) => r + 1);
                }}
                disabled={isRunning}
              >
                {isGCSMode() ? (
                  <IconCloud className="mr-1 size-4" />
                ) : (
                  <IconFolder className="mr-1 size-4" />
                )}
                {isGCSMode() ? "GCS" : "Local"}
              </Button>
            )}
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
          ref={setScrollContainer}
          className="grid auto-rows-min gap-2 overflow-y-auto pr-1"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            maxHeight: "calc(80dvh - 160px)",
          }}
        >
          {sortedPresetList.map((poi) => (
            <PresetCard
              key={poi.id}
              poi={poi}
              revision={revision}
              onJump={() => {
                jumpToPreset(poi);
                closeAndSaveScroll();
                // 選択結果をキャンバスで見せるためPOI drawerも閉じる
                updateStore("poiDrawerSnap", "closed");
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
  const thumbnailUrl = getPresetThumbnailUrl(poi.id, revision);
  const label = getPresetDisplayLabel(poi);
  const r = new BigNumber(poi.r);

  return (
    <div className="group overflow-hidden rounded border border-[#2a2a3a] bg-[#1e1e2e] transition-colors hover:border-primary/50">
      <button
        onClick={onJump}
        className="relative aspect-square w-full overflow-hidden bg-[#0a0a14]"
      >
        <img
          crossOrigin="anonymous"
          src={thumbnailUrl}
          alt={`Preset ${label}`}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Jump
        </div>
      </button>
      <div className="flex items-center justify-between gap-1 px-2 pt-0.5 pb-1">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-bold leading-tight" title={label}>
            {label}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            N:{poi.N} r:{r.toPrecision(3)}
          </div>
        </div>
        {isDevMode() && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
          >
            <IconTrash className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

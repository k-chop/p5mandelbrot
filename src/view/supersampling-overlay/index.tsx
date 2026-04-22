import { LoadingSpinner } from "@/components/loading-spinner";
import { useT } from "@/i18n/context";
import { getPrevBatchId } from "@/mandelbrot-state/mandelbrot-state";
import { Button } from "@/shadcn/components/ui/button";
import { useStoreValue } from "@/store/store";
import { cancelBatch } from "@/worker-pool/worker-pool";
import { Download, Expand, Shrink, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ProgressBarInline } from "../progress-bar";

interface SupersamplingOverlayProps {
  onClose?: () => void;
}

/** 閉じるアニメーションの時間 (ms)。Dialogの見た目に合わせる */
const CLOSE_ANIMATION_MS = 200;

const SupersamplingOverlayComponent = ({ onClose }: SupersamplingOverlayProps) => {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitMode, setFitMode] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [dragState, setDragState] = useState({
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  // progress が object (ResultSpans = 計測完了) のとき描画完了。保存ボタン等の出し分けに使う
  const progress = useStoreValue("progress");
  const isRenderComplete = typeof progress === "object" && progress !== null;

  const handleToggleFitMode = useCallback(() => {
    setFitMode((prev) => !prev);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (fitMode || !containerRef.current) return;

      setDragState({
        isDragging: true,
        startX: e.pageX - containerRef.current.offsetLeft,
        startY: e.pageY - containerRef.current.offsetTop,
        scrollLeft: containerRef.current.scrollLeft,
        scrollTop: containerRef.current.scrollTop,
      });
    },
    [fitMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState.isDragging || !containerRef.current) return;

      e.preventDefault();
      const x = e.pageX - containerRef.current.offsetLeft;
      const y = e.pageY - containerRef.current.offsetTop;
      const walkX = (x - dragState.startX) * 1;
      const walkY = (y - dragState.startY) * 1;

      containerRef.current.scrollLeft = dragState.scrollLeft - walkX;
      containerRef.current.scrollTop = dragState.scrollTop - walkY;
    },
    [dragState],
  );

  const handleMouseUp = useCallback(() => {
    setDragState((prev) => ({ ...prev, isDragging: false }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setDragState((prev) => ({ ...prev, isDragging: false }));
  }, []);

  const handleBackgroundEvent = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    // fadeアニメ完了後に実DOM cleanupを行う
    setTimeout(() => {
      const canvas = document.getElementById("supersampling-canvas") as HTMLCanvasElement;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }

      const overlay = document.getElementById("supersampling-overlay");
      if (overlay) {
        overlay.style.display = "";
      }
      // 処理中だったらバッチを止める
      cancelBatch(getPrevBatchId());

      setIsClosing(false);
      onClose?.();
    }, CLOSE_ANIMATION_MS);
  }, [isClosing, onClose]);

  /** supersampling結果canvasをPNGとしてダウンロード */
  const handleSave = useCallback(() => {
    const canvas = document.getElementById("supersampling-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `mandelbrot-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, []);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [handleClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm transition-opacity duration-200 ease-out ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      onMouseDown={handleBackgroundEvent}
      onClick={handleBackgroundEvent}
    >
      {/* Dialog本体 */}
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/15 bg-background shadow-2xl transition-[opacity,transform] duration-200 ease-out ${
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        {/* Header: タイトル + × */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2">
          <h2 className="text-base font-semibold">
            {t("Supersampling Result", "supersampling.result")}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded p-1 text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content: canvasコンテナ */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={containerRef}
            className={
              fitMode
                ? "flex h-full w-full items-center justify-center"
                : "h-full w-full cursor-grab overflow-auto active:cursor-grabbing"
            }
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStartCapture={(e) => e.stopPropagation()}
            onTouchMoveCapture={(e) => e.stopPropagation()}
            style={fitMode ? {} : { cursor: dragState.isDragging ? "grabbing" : "grab" }}
          >
            {/* ローディングスピナー - 描画完了までcanvasの背後に表示 */}
            {!isRenderComplete && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-black/80 px-6 py-4 text-white shadow-lg backdrop-blur-sm">
                  <LoadingSpinner />
                  <span className="text-sm font-medium">Supersampling...</span>
                </div>
              </div>
            )}

            <canvas
              key="supersampling-canvas"
              id="supersampling-canvas"
              ref={canvasRef}
              className={
                fitMode
                  ? "relative z-10 max-h-full max-w-full object-contain"
                  : "relative z-10 block"
              }
              style={
                fitMode
                  ? {}
                  : {
                      imageRendering: "pixelated",
                      minWidth: "100%",
                      minHeight: "100%",
                      display: "block",
                    }
              }
            />
          </div>
        </div>

        {/* Progress (描画の進捗/結果)。モバイルfooterと同じ薄帯スタイルでDialog下部に埋め込み */}
        <div className="shrink-0 border-t border-white/10">
          <ProgressBarInline />
        </div>

        {/* Footer: 拡大切替 + ダウンロード (生成中はdisable) */}
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleFitMode}
            disabled={!isRenderComplete}
          >
            {fitMode ? <Expand className="mr-1 size-4" /> : <Shrink className="mr-1 size-4" />}
            {fitMode
              ? t("Actual Size", "supersampling.actualSize")
              : t("Fit to Screen", "supersampling.fitToScreen")}
          </Button>
          <Button variant="default" size="sm" onClick={handleSave} disabled={!isRenderComplete}>
            <Download className="mr-1 size-4" />
            {t("Save Image", "header.saveImage")}
          </Button>
        </div>
      </div>
    </div>
  );
};

SupersamplingOverlayComponent.displayName = "SupersamplingOverlay";

export const SupersamplingOverlay = memo(SupersamplingOverlayComponent);

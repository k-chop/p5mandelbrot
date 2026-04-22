import { LoadingSpinner } from "@/components/loading-spinner";
import { getPrevBatchId } from "@/mandelbrot-state/mandelbrot-state";
import { useStoreValue } from "@/store/store";
import { cancelBatch } from "@/worker-pool/worker-pool";
import { Download, Expand, Shrink, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Footer } from "../footer";

interface SupersamplingOverlayProps {
  onClose?: () => void;
}

/** overlay上の丸型ボタンのベースクラス (メインUIのsize-16に揃える) */
const CIRCLE_BUTTON_BASE_CLASS =
  "size-16 rounded-full bg-black/80 text-white/80 border border-white/20 backdrop-blur-sm shadow-lg flex items-center justify-center transition-colors";

const SupersamplingOverlayComponent = ({ onClose }: SupersamplingOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitMode, setFitMode] = useState(true);
  const [dragState, setDragState] = useState({
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  // progress が object (ResultSpans = 計測完了) のとき描画完了。保存ボタンの出し分けに使う
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
    // 閉じるときにcanvasのメモリ解放しておく
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

    onClose?.();
  }, [onClose]);

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
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onMouseDown={handleBackgroundEvent}
      onClick={handleBackgroundEvent}
    >
      {/* キャンバスコンテナ */}
      <div
        ref={containerRef}
        className={
          fitMode
            ? "w-full h-full flex items-center justify-center"
            : "w-full h-full overflow-auto cursor-grab active:cursor-grabbing"
        }
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStartCapture={(e) => e.stopPropagation()}
        onTouchMoveCapture={(e) => e.stopPropagation()}
        style={fitMode ? {} : { cursor: dragState.isDragging ? "grabbing" : "grab" }}
      >
        {/* ローディングスピナー - canvasの下に表示 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/80 text-white px-6 py-4 rounded-lg shadow-lg backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-3">
              <LoadingSpinner />
              <span className="text-sm font-medium">Supersampling...</span>
            </div>
          </div>
        </div>

        <canvas
          key="supersampling-canvas"
          id="supersampling-canvas"
          ref={canvasRef}
          className={
            fitMode ? "max-w-full max-h-full object-contain relative z-10" : "block relative z-10"
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

      {/* 左上の閉じるボタン (丸型) */}
      <div className="absolute top-4 left-4 z-20">
        <button
          type="button"
          onClick={handleClose}
          className={`${CIRCLE_BUTTON_BASE_CLASS} hover:bg-red-500/70 hover:text-white`}
          aria-label="Close"
        >
          <X className="size-8" />
        </button>
      </div>

      {/* 右上のコントロール (縦並び: Fit切替 + 保存、保存は描画完了時のみ) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleToggleFitMode}
          className={`${CIRCLE_BUTTON_BASE_CLASS} hover:bg-white/20 hover:text-white`}
          aria-label={fitMode ? "Actual Size" : "Fit to Screen"}
        >
          {fitMode ? <Expand className="size-8" /> : <Shrink className="size-8" />}
        </button>
        {isRenderComplete && (
          <button
            type="button"
            onClick={handleSave}
            className={`${CIRCLE_BUTTON_BASE_CLASS} hover:bg-white/20 hover:text-white`}
            aria-label="Save image"
          >
            <Download className="size-8" />
          </button>
        )}
      </div>
      <div className="absolute bottom-4 z-1 w-full px-8">
        <Progress />
      </div>
    </div>
  );
};

SupersamplingOverlayComponent.displayName = "SupersamplingOverlay";

export const SupersamplingOverlay = memo(SupersamplingOverlayComponent);

const Progress = () => {
  return <Footer />;
};

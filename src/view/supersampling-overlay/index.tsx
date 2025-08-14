import { memo, useCallback, useEffect, useRef, useState } from "react";

interface SupersamplingOverlayProps {
  onClose?: () => void;
}

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
    const overlay = document.getElementById("supersampling-overlay");
    if (overlay) {
      overlay.style.display = "";
    }
    onClose?.();
  }, [onClose]);

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
        style={fitMode ? {} : { cursor: dragState.isDragging ? "grabbing" : "grab" }}
      >
        <canvas
          key="supersampling-canvas"
          id="supersampling-canvas"
          ref={canvasRef}
          className={fitMode ? "max-w-full max-h-full object-contain" : "block"}
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

      {/* 左上の閉じるボタン */}
      <div className="absolute top-4 left-4">
        <button
          onClick={handleClose}
          className="p-2 text-white/80 bg-black/80 hover:text-white hover:bg-red-500/70 rounded-full shadow-lg transition-colors backdrop-blur-sm border border-white/20"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 右上のコントロール */}
      <div className="absolute top-4 right-4">
        <button
          onClick={handleToggleFitMode}
          className="px-3 py-1 text-sm bg-blue-500/90 text-white rounded shadow-lg hover:bg-blue-600/90 transition-colors backdrop-blur-sm"
        >
          {fitMode ? "原寸表示" : "フィット表示"}
        </button>
      </div>
    </div>
  );
};

SupersamplingOverlayComponent.displayName = "SupersamplingOverlay";

export const SupersamplingOverlay = memo(SupersamplingOverlayComponent);

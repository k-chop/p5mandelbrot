import { useRef, useState, useCallback, memo } from "react";

interface SupersamplingOverlayProps {
  onClose?: () => void;
}

const SupersamplingOverlayComponent = ({ onClose }: SupersamplingOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fitMode, setFitMode] = useState(true);

  const handleToggleFitMode = useCallback(() => {
    setFitMode(prev => !prev);
  }, []);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      {/* キャンバス - 画面フルサイズ */}
      <canvas
        key="supersampling-canvas"
        id="supersampling-canvas"
        ref={canvasRef}
        className={
          fitMode
            ? "w-full h-full object-contain"
            : "w-full h-full object-none object-center"
        }
        style={fitMode ? {} : { imageRendering: "pixelated" }}
      />
      
      {/* UIコントロール - canvas上にoverlay */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={handleToggleFitMode}
          className="px-3 py-1 text-sm bg-blue-500/90 text-white rounded shadow-lg hover:bg-blue-600/90 transition-colors backdrop-blur-sm"
        >
          {fitMode ? "原寸表示" : "フィット表示"}
        </button>
        {onClose && (
          <button
            onClick={handleClose}
            className="p-2 text-white/80 hover:text-white hover:bg-black/20 rounded shadow-lg transition-colors backdrop-blur-sm"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

SupersamplingOverlayComponent.displayName = "SupersamplingOverlay";

export const SupersamplingOverlay = memo(SupersamplingOverlayComponent);

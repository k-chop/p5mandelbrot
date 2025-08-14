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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* ヘッダー部分 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Supersampling Preview</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFitMode}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {fitMode ? "原寸表示" : "フィット表示"}
            </button>
            {onClose && (
              <button
                onClick={handleClose}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
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

        {/* キャンバス部分 */}
        <div className="p-4">
          <div className="flex justify-center">
            <canvas
              key="supersampling-canvas"
              id="supersampling-canvas"
              ref={canvasRef}
              className={
                fitMode
                  ? "max-w-full max-h-[70vh] object-contain"
                  : "block"
              }
              style={fitMode ? {} : { imageRendering: "pixelated" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

SupersamplingOverlayComponent.displayName = "SupersamplingOverlay";

export const SupersamplingOverlay = memo(SupersamplingOverlayComponent);

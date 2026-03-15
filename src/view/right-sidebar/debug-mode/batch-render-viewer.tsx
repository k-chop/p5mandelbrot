import type {
  BatchRenderEntry,
  WorkerRenderArea,
} from "@/batch-render-history/batch-render-history";
import { useBatchRenderHistory } from "@/batch-render-history/use-batch-render-history";
import type { Rect } from "@/math/rect";
import { getCanvasSize } from "@/rendering/renderer";
import { useState } from "react";

const MINIMAP_WIDTH = 300;
const MINIMAP_HEIGHT = 300;

const WORKER_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
];

const BatchMinimap = ({ entry, index }: { entry: BatchRenderEntry; index: number }) => {
  const [hoveredWorker, setHoveredWorker] = useState<WorkerRenderArea | null>(null);
  const canvasSize = getCanvasSize();

  if (canvasSize.width === 0 || canvasSize.height === 0) {
    return null;
  }

  const allRects = entry.workers.map((w) => w.rect);

  const bounds = {
    minX: Math.min(...allRects.map((r) => r.x), 0),
    minY: Math.min(...allRects.map((r) => r.y), 0),
    maxX: Math.max(...allRects.map((r) => r.x + r.width), canvasSize.width),
    maxY: Math.max(...allRects.map((r) => r.y + r.height), canvasSize.height),
  };

  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;
  const boundsAspect = boundsWidth / boundsHeight;

  let effectiveWidth: number, effectiveHeight: number;
  if (boundsAspect > 1) {
    effectiveWidth = MINIMAP_WIDTH;
    effectiveHeight = MINIMAP_WIDTH / boundsAspect;
  } else {
    effectiveWidth = MINIMAP_HEIGHT * boundsAspect;
    effectiveHeight = MINIMAP_HEIGHT;
  }

  const normalizeToSVG = (rect: Rect) => ({
    x: ((rect.x - bounds.minX) / boundsWidth) * effectiveWidth,
    y: ((rect.y - bounds.minY) / boundsHeight) * effectiveHeight,
    width: (rect.width / boundsWidth) * effectiveWidth,
    height: (rect.height / boundsHeight) * effectiveHeight,
  });

  const canvasViewRect = normalizeToSVG({
    x: 0,
    y: 0,
    width: canvasSize.width,
    height: canvasSize.height,
  });

  const uniqueWorkerIdxs = [...new Set(entry.workers.map((w) => w.workerIdx))].sort(
    (a, b) => a - b,
  );

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        Workers: {uniqueWorkerIdxs.length}, Areas: {entry.workers.length}
      </div>

      <div className="relative">
        <svg
          width={effectiveWidth}
          height={effectiveHeight}
          className="rounded border"
          style={{ backgroundColor: "#f8fafc" }}
        >
          <defs>
            <pattern
              id={`batch-grid-${index}`}
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect
            width={effectiveWidth}
            height={effectiveHeight}
            fill={`url(#batch-grid-${index})`}
          />

          {entry.workers.map((worker, i) => {
            const color = WORKER_COLORS[worker.workerIdx % WORKER_COLORS.length];
            const normalized = normalizeToSVG(worker.rect);
            return (
              <rect
                key={i}
                x={normalized.x}
                y={normalized.y}
                width={normalized.width}
                height={normalized.height}
                fill={color}
                fillOpacity={0.6}
                stroke={color}
                strokeWidth={1}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={() => setHoveredWorker(worker)}
                onMouseLeave={() => setHoveredWorker(null)}
              />
            );
          })}

          <rect
            x={canvasViewRect.x}
            y={canvasViewRect.y}
            width={canvasViewRect.width}
            height={canvasViewRect.height}
            fill="none"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="4,2"
            className="pointer-events-none"
          />
        </svg>

        {hoveredWorker && (
          <div className="absolute top-full left-0 z-20 mt-2 rounded bg-black px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg">
            <div>Worker: {hoveredWorker.workerId}</div>
            <div>
              Position: ({hoveredWorker.rect.x.toFixed(1)}, {hoveredWorker.rect.y.toFixed(1)})
            </div>
            <div>
              Size: {hoveredWorker.rect.width.toFixed(1)}×{hoveredWorker.rect.height.toFixed(1)}
            </div>
            <div>Elapsed: {hoveredWorker.elapsed.toFixed(1)}ms</div>
            <div className="absolute bottom-full left-4 h-0 w-0 border-r-4 border-b-4 border-l-4 border-transparent border-b-black" />
          </div>
        )}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 border-2 border-dashed" style={{ borderColor: "#ef4444" }} />
          <span className="font-medium text-red-600">
            Canvas ({canvasSize.width}×{canvasSize.height})
          </span>
        </div>
        {uniqueWorkerIdxs.map((workerIdx) => {
          const color = WORKER_COLORS[workerIdx % WORKER_COLORS.length];
          return (
            <div key={workerIdx} className="flex items-center gap-1">
              <div className="h-3 w-3 border" style={{ backgroundColor: color, opacity: 0.6 }} />
              <span>iteration-{workerIdx}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const BatchRenderViewer = () => {
  const history = useBatchRenderHistory();

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Batch Render History ({history.length})</h3>
      </div>

      {history.length === 0 ? (
        <div className="text-muted-foreground text-sm italic">バッチ履歴はありません</div>
      ) : (
        <div className="space-y-4">
          {history.map((entry, index) => (
            <div key={entry.batchId} className="space-y-2 rounded-lg border p-3">
              <div className="text-sm font-medium">
                Batch #{history.length - index}
                <span className="text-muted-foreground ml-2 text-xs">
                  {new Date(entry.startedAt).toLocaleTimeString()}
                </span>
              </div>
              <BatchMinimap entry={entry} index={index} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

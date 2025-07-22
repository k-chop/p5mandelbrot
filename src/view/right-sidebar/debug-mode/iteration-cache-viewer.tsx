import { getIterationCache } from "@/iteration-buffer/iteration-buffer";
import { Button } from "@/shadcn/components/ui/button";
import type { IterationBuffer } from "@/types";
import { useState } from "react";

export const IterationCacheViewer = () => {
  const [cacheData, setCacheData] = useState<IterationBuffer[]>([]);

  // FIXME: こんなん表示しても意味ないのであとで修正する

  const loadCache = () => {
    const cache = getIterationCache();
    setCacheData(cache);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatRect = (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    return `(${rect.x.toFixed(1)}, ${rect.y.toFixed(1)}) ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Iteration Cache</h3>
        <Button onClick={loadCache} variant="outline" size="sm">
          リロード
        </Button>
      </div>

      <div className="space-y-2">
        <div className="text-muted-foreground text-sm">
          キャッシュ数: {cacheData.length}
        </div>

        {cacheData.length === 0 ? (
          <div className="text-muted-foreground text-sm italic">
            リロードボタンを押してキャッシュを表示
          </div>
        ) : (
          <div className="space-y-2">
            {cacheData.map((cache, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border p-3 text-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="font-medium">Cache #{index + 1}</div>
                  {cache.isSuperSampled && (
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                      Super Sampled
                    </span>
                  )}
                </div>

                <div className="text-muted-foreground grid grid-cols-1 gap-1 text-xs">
                  <div>
                    <span className="font-medium">位置:</span>{" "}
                    {formatRect(cache.rect)}
                  </div>
                  <div>
                    <span className="font-medium">解像度:</span>{" "}
                    {cache.resolution.width}×{cache.resolution.height}
                  </div>
                  <div>
                    <span className="font-medium">バッファサイズ:</span>{" "}
                    {formatBytes(cache.buffer.byteLength)}
                  </div>
                  <div>
                    <span className="font-medium">ピクセル数:</span>{" "}
                    {cache.buffer.length.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

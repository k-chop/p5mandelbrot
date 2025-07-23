import { getIterationCache } from "@/iteration-buffer/iteration-buffer";
import { Button } from "@/shadcn/components/ui/button";
import type { IterationBuffer } from "@/types";
import { useState } from "react";

interface SizeGroup {
  rectSize: { width: number; height: number };
  resolution: { width: number; height: number };
  items: IterationBuffer[];
  hasSuperSampled: boolean;
}

interface ScaleGroup {
  scale: number;
  sizeGroups: SizeGroup[];
}

export const IterationCacheViewer = () => {
  const [cacheData, setCacheData] = useState<IterationBuffer[]>([]);
  const loadCache = () => {
    const cache = getIterationCache();
    setCacheData(cache);
  };

  const groupCacheData = (cacheData: IterationBuffer[]): ScaleGroup[] => {
    // 1段階目: scaleでグループ化
    const scaleGroups = new Map<number, Map<string, SizeGroup>>();

    for (const cache of cacheData) {
      const rectSize = { width: cache.rect.width, height: cache.rect.height };
      const resolution = cache.resolution;
      const scale =
        (rectSize.width * rectSize.height) /
        (resolution.width * resolution.height);
      const sizeKey = `${rectSize.width}x${rectSize.height}-${resolution.width}x${resolution.height}`;

      if (!scaleGroups.has(scale)) {
        scaleGroups.set(scale, new Map<string, SizeGroup>());
      }

      const sizeGroupsForScale = scaleGroups.get(scale)!;

      if (!sizeGroupsForScale.has(sizeKey)) {
        sizeGroupsForScale.set(sizeKey, {
          rectSize,
          resolution,
          items: [],
          hasSuperSampled: false,
        });
      }

      const sizeGroup = sizeGroupsForScale.get(sizeKey)!;
      sizeGroup.items.push(cache);
      if (cache.isSuperSampled) {
        sizeGroup.hasSuperSampled = true;
      }
    }

    // 結果をScaleGroup[]に変換してソート
    return Array.from(scaleGroups.entries())
      .map(([scale, sizeGroupsMap]) => ({
        scale,
        sizeGroups: Array.from(sizeGroupsMap.values()).sort((a, b) => {
          const aRectArea = a.rectSize.width * a.rectSize.height;
          const bRectArea = b.rectSize.width * b.rectSize.height;
          return bRectArea - aRectArea; // rectサイズが大きい順
        }),
      }))
      .sort((a, b) => b.scale - a.scale); // scaleが大きい順（解像度が荒い順）
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Iteration Cache (count: {cacheData.length})
        </h3>
        <Button onClick={loadCache} variant="outline" size="sm">
          リロード
        </Button>
      </div>

      <div className="space-y-4">
        {(() => {
          const scaleGroups = groupCacheData(cacheData);
          return (
            <>
              {scaleGroups.length === 0 ? (
                <div className="text-muted-foreground text-sm italic">
                  リロードボタンを押してキャッシュを表示
                </div>
              ) : (
                <div className="space-y-4">
                  {scaleGroups.map((scaleGroup, scaleIndex) => (
                    <div key={scaleIndex} className="space-y-2">
                      <div className="text-base font-semibold">
                        Scale: {scaleGroup.scale.toFixed(2)}
                      </div>

                      <div className="space-y-2 pl-4">
                        {scaleGroup.sizeGroups.map((sizeGroup, sizeIndex) => (
                          <div
                            key={sizeIndex}
                            className="rounded-lg border p-3 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {sizeGroup.rectSize.width.toFixed(1)}×
                                {sizeGroup.rectSize.height.toFixed(1)} @{" "}
                                {sizeGroup.resolution.width}×
                                {sizeGroup.resolution.height} -{" "}
                                {sizeGroup.items.length}個
                              </span>
                              {sizeGroup.hasSuperSampled && (
                                <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                                  Super Sampled
                                </span>
                              )}
                            </div>

                            <div className="mt-3 space-y-1 pl-4">
                              {sizeGroup.items.map((cache, itemIndex) => (
                                <div
                                  key={itemIndex}
                                  className="text-muted-foreground text-xs"
                                >
                                  • ({cache.rect.x.toFixed(1)},{" "}
                                  {cache.rect.y.toFixed(1)})
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
};

import { loadPreview, useTrackChangePreview } from "@/store/preview-store";
import type { POIData } from "@/types";
import React, { useEffect, useState } from "react";

type Props = {
  poi: POIData;
  /** サムネイルのアスペクト比指定 ("square": 1:1クロップ表示, "natural": 元画像のアスペクトを保持) */
  aspect?: "square" | "natural";
};

export const POICardPreview = React.memo(({ poi, aspect = "square" }: Props) => {
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const previewChanged = useTrackChangePreview(poi.id);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const result = await loadPreview(poi.id);
        if (!isCancelled) {
          setData(result);
          setIsLoading(false);
        }
      } catch {
        if (!isCancelled) {
          setData(null);
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [poi.id, previewChanged]);

  const isSquare = aspect === "square";
  const containerClass = isSquare
    ? "flex w-full aspect-square items-center justify-center border-2"
    : "flex h-full items-center justify-center border-2";
  const imgClass = isSquare ? "w-full aspect-square object-cover" : "h-full w-auto object-contain";

  if (isLoading) {
    return <div className={containerClass}>loading...</div>;
  }

  if (data == null) {
    return <div className={containerClass}>No Image</div>;
  }

  return <img src={data} className={imgClass} />;
});
POICardPreview.displayName = "POICardPreview";

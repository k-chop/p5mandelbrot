import { loadPreview, useTrackChangePreview } from "@/store/preview-store";
import type { POIData } from "@/types";
import React, { useEffect, useState } from "react";

type Props = {
  poi: POIData;
};

export const POICardPreview = React.memo(({ poi }: Props) => {
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useTrackChangePreview(poi.id);

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

    load();

    return () => {
      isCancelled = true;
    };
  }, [poi.id]);

  if (isLoading) {
    return <div className="flex size-[100px] items-center justify-center border-2">loading...</div>;
  }

  if (data == null) {
    return <div className="flex size-[100px] items-center justify-center border-2">No Image</div>;
  }

  return <img src={data} />;
});
POICardPreview.displayName = "POICardPreview";

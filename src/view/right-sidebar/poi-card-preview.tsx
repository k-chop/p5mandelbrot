import { loadPreview, useTrackChangePreview } from "@/store/preview-store";
import { POIData } from "@/types";
import React from "react";
import usePromise from "react-promise-suspense";

type Props = {
  poi: POIData;
};

export const POICardPreview = React.memo(({ poi }: Props) => {
  const data = usePromise(loadPreview, [poi.id], 1000);

  useTrackChangePreview(poi.id);

  if (data == null)
    return (
      <div className="flex size-[100px] items-center justify-center border-2">
        No Image
      </div>
    );

  return <img src={data} />;
});
POICardPreview.displayName = "POICardPreview";

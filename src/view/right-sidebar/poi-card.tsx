import {
  IconArrowBigLeftLine,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { POIData } from "../../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { POICardPreview } from "./poi-card-preview";
import { Suspense } from "react";
import { useStoreValue } from "@/store/store";

type POICardProps = {
  poi: POIData;
  onDelete: () => void;
  onApply: () => void;
  onRegenerateThumbnail: () => void;
};

export const POICard = ({
  poi,
  onDelete,
  onApply,
  onRegenerateThumbnail,
}: POICardProps) => {
  const { r, N, id } = poi;

  const canRegenerate = useIsInSamePlace(poi);

  return (
    <Card className="w-64 p-2">
      <div className="flex">
        <div className="">
          <Suspense fallback={"loading..."}>
            <POICardPreview poi={poi} />
          </Suspense>
        </div>
        <div className="ml-2 flex flex-grow flex-col">
          <div className="flex justify-between">
            <div>r</div>
            <div>{r.toPrecision(5)}</div>
          </div>
          <div className="flex justify-between">
            <div>N</div>
            <div>{N.toFixed(0)}</div>
          </div>

          <div className="mt-2 flex justify-between">
            {canRegenerate ? (
              <Button
                variant="secondary"
                size="icon"
                onClick={onRegenerateThumbnail}
              >
                <IconRefresh />
              </Button>
            ) : (
              <Button variant="default" size="icon" onClick={onApply}>
                <IconArrowBigLeftLine />
              </Button>
            )}
            <Button variant="destructive" size="icon" onClick={onDelete}>
              <IconTrash />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

const useIsInSamePlace = (poi: POIData) => {
  const centerX = useStoreValue("centerX");
  const centerY = useStoreValue("centerY");
  const r = useStoreValue("r");
  const N = useStoreValue("N");
  const mode = useStoreValue("mode");

  return (
    poi.x.eq(centerX) &&
    poi.y.eq(centerY) &&
    poi.r.eq(r) &&
    poi.N === N &&
    poi.mode === mode
  );
};

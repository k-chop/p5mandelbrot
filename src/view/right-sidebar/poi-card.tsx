import { SimpleTooltip } from "@/components/simple-tooltip";
import { Button } from "@/shadcn/components/ui/button";
import { Card } from "@/shadcn/components/ui/card";
import { useStoreValue } from "@/store/store";
import {
  IconArrowBigLeftLine,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { Suspense } from "react";
import { POIData } from "../../types";
import { POICardPreview } from "./poi-card-preview";

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
  const { r, N } = poi;

  const canRegenerate = useIsInSamePlace(poi);

  return (
    <Card className="w-64 p-2">
      <div className="flex">
        <div className="">
          <Suspense fallback={"loading..."}>
            <POICardPreview poi={poi} />
          </Suspense>
        </div>
        <div className="ml-2 flex grow flex-col">
          <div className="flex justify-between">
            <div>r</div>
            <div>{r.toPrecision(5)}</div>
          </div>
          <div className="flex justify-between">
            <div>N</div>
            <div>{N.toFixed(0)}</div>
          </div>

          <div className="mt-2 flex justify-between">
            <SimpleTooltip content="Apply params">
              <Button variant="default" size="icon" onClick={onApply}>
                <IconArrowBigLeftLine />
              </Button>
            </SimpleTooltip>
            {canRegenerate && (
              <SimpleTooltip content="Regenerate thumbnail">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={onRegenerateThumbnail}
                >
                  <IconRefresh />
                </Button>
              </SimpleTooltip>
            )}
            <SimpleTooltip content="Delete">
              <Button variant="destructive" size="icon" onClick={onDelete}>
                <IconTrash />
              </Button>
            </SimpleTooltip>
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

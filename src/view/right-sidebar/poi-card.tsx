import { IconArrowBigLeftLine, IconTrash } from "@tabler/icons-react";
import { POIData } from "../../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { POICardPreview } from "./poi-card-preview";
import { Suspense } from "react";

type POICardProps = {
  poi: POIData;
  onDelete: () => void;
  onApply: () => void;
};

export const POICard = ({ poi, onDelete, onApply }: POICardProps) => {
  const { r, N, id } = poi;

  return (
    <Card className="p-2">
      <div className="flex">
        <div className="">
          <Suspense fallback={"loading..."}>
            <POICardPreview poiId={id} />
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
            <Button variant="default" size="icon" onClick={onApply}>
              <IconArrowBigLeftLine />
            </Button>
            <Button variant="destructive" size="icon" onClick={onDelete}>
              <IconTrash />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

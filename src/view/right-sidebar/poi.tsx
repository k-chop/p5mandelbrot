import { POICard } from "./poi-card";
import { IconCirclePlus } from "@tabler/icons-react";
import { usePOI } from "./use-poi";
import { cloneParams, getCurrentParams } from "../../mandelbrot";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export const POI = () => {
  const { poiList, addPOI, deletePOIAt, applyPOI } = usePOI();

  return (
    <>
      <div className="flex-none">
        <div className="mb-2 flex justify-between">
          <Button
            variant="default"
            size="sm"
            className="w-64"
            onClick={() => addPOI(cloneParams(getCurrentParams()))}
          >
            <IconCirclePlus className="mr-2 h-6 w-6" />
            Save POI
          </Button>
        </div>
      </div>

      <ScrollArea className="flex min-h-10 flex-grow basis-0 flex-col overflow-y-auto pr-3">
        <div>
          <div className="flex flex-row flex-wrap gap-2">
            {poiList.map((poi, index) => (
              <POICard
                key={poi.id}
                poi={poi}
                onDelete={() => deletePOIAt(index)}
                onApply={() => applyPOI(poi)}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </>
  );
};

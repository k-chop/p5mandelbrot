import { POICard } from "./poi-card";
import {
  IconCircleCheck,
  IconCirclePlus,
  IconShare,
} from "@tabler/icons-react";
import { usePOI } from "./use-poi";
import { cloneParams, getCurrentParams } from "../../mandelbrot";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";

export const POI = () => {
  const { poiList, addPOI, deletePOIAt, applyPOI } = usePOI();
  const { toast } = useToast();

  return (
    <>
      <div className="pr-4">
        <div className="mb-2 flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              toast({
                title: (
                  <div className="flex items-center justify-center gap-2">
                    <IconCircleCheck />
                    Current location URL copied to clipboard!
                  </div>
                ),
                variant: "primary",
              })
            }
          >
            <IconShare className="mr-1 h-6 w-6" />
            Share
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => addPOI(cloneParams(getCurrentParams()))}
          >
            <IconCirclePlus className="mr-2 h-6 w-6" />
            Save POI
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[500px]">
        <div className="pr-4">
          <div className="flex flex-col gap-2">
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

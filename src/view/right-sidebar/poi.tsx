import { POICard } from "./poi-card";
import { IconCirclePlus } from "@tabler/icons-react";
import { usePOI } from "./use-poi";
import { cloneParams, getCurrentParams } from "../../mandelbrot";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";
import throttle from "lodash.throttle";

export const POI = () => {
  const { poiList, addPOI, deletePOIAt, applyPOI, regenerateThumbnailPOI } =
    usePOI();
  const scrollTop = useRef(parseInt(sessionStorage.getItem("scroll") ?? "0"));
  const viewportRef = useRef<HTMLDivElement>(null);

  const handleScroll = throttle((e: any) => {
    scrollTop.current = e.target.scrollTop;
  }, 500);

  useEffect(() => {
    const scroll = scrollTop.current;
    if (viewportRef.current) {
      viewportRef.current.scrollTop = scroll;
    }

    return () => {
      sessionStorage.setItem("scroll", scrollTop.current.toString());
    };
  }, []);

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

      <ScrollArea
        ref={viewportRef}
        className="flex min-h-10 flex-grow basis-0 flex-col overflow-y-auto"
        onScroll={handleScroll}
      >
        <div>
          <div className="flex flex-row flex-wrap gap-2">
            {poiList.map((poi, index) => (
              <POICard
                key={poi.id}
                poi={poi}
                onDelete={() => deletePOIAt(index)}
                onApply={() => applyPOI(poi)}
                onRegenerateThumbnail={() => regenerateThumbnailPOI(index)}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </>
  );
};

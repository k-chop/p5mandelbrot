import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cloneCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { IconCirclePlus } from "@tabler/icons-react";
import throttle from "lodash.throttle";
import { useEffect, useRef } from "react";
import { POICard } from "./poi-card";
import { usePOI } from "./use-poi";

export const POI = () => {
  const { poiList, addPOI, deletePOIAt, applyPOI, regenerateThumbnailPOI } =
    usePOI();
  const scrollTop = useRef(parseInt(sessionStorage.getItem("scroll") ?? "0"));
  const viewportRef = useRef<HTMLDivElement>(null);

  const handleScroll = throttle((e: React.UIEvent<HTMLDivElement>) => {
    scrollTop.current = e.currentTarget.scrollTop;
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
            onClick={() => addPOI(cloneCurrentParams())}
          >
            <IconCirclePlus className="mr-2 size-6" />
            Save POI
          </Button>
        </div>
      </div>

      <ScrollArea
        ref={viewportRef}
        className="flex min-h-10 grow basis-0 flex-col overflow-y-auto"
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

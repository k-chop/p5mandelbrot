import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { usePOIHistories } from "@/poi-history/poi-history";
import { useMemo } from "react";

export const POIHistories = () => {
  const raw = usePOIHistories();
  const histories = useMemo(() => raw.slice().reverse(), [raw]);

  return (
    <ScrollArea className="w-full">
      <div className="r-4 flex flex-nowrap gap-2 px-2 py-4">
        {histories.map((history) => {
          return (
            <div key={history.id} className="min-w-[100px]">
              <img
                src={history.imageDataUrl}
                width="100"
                className=" rounded-xl"
              />
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

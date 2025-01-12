import { usePOIHistories } from "@/poi-history/poi-history";
import { ScrollArea, ScrollBar } from "@/shadcn/components/ui/scroll-area";
import { useMemo } from "react";
import { usePOI } from "./use-poi";

/**
 * 履歴データの表示コンポーネント
 */
export const POIHistories = () => {
  const raw = usePOIHistories();
  const { applyPOI } = usePOI();
  const histories = useMemo(() => raw.slice().reverse(), [raw]);

  return (
    <ScrollArea className="w-full">
      <div className="flex flex-nowrap gap-2 px-2 py-4">
        {histories.map((history) => {
          return (
            <div key={history.id} className="min-w-[100px]">
              <button onClick={() => applyPOI(history)}>
                <img
                  src={history.imageDataUrl}
                  width="100"
                  className="rounded-xl"
                />
              </button>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

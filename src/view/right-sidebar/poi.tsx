import { Container, Group, ScrollArea, Stack } from "@mantine/core";
import { POICard } from "./poi-card";
import { IconCirclePlus } from "@tabler/icons-react";
import { usePOI } from "./use-poi";
import { cloneParams, getCurrentParams } from "../../mandelbrot";
import { Button } from "@/components/ui/button";

export const POI = () => {
  const { poiList, addPOI, deletePOIAt, applyPOI } = usePOI();

  return (
    <ScrollArea h={500} offsetScrollbars>
      <div>
        <div className="mb-2 flex justify-end">
          <Button
            variant="default"
            onClick={() => addPOI(cloneParams(getCurrentParams()))}
          >
            <IconCirclePlus className="mr-2 h-6 w-6" />
            Save POI
          </Button>
        </div>
        <Stack>
          {poiList.map((poi, index) => (
            <POICard
              key={index}
              poi={poi}
              onDelete={() => deletePOIAt(index)}
              onApply={() => applyPOI(poi)}
            />
          ))}
        </Stack>
      </div>
    </ScrollArea>
  );
};

import { Button, Container, Group, ScrollArea, Stack } from "@mantine/core";
import { POICard } from "./poi-card";
import { IconCirclePlus } from "@tabler/icons-react";
import { usePOI } from "./use-poi";
import { cloneParams, getCurrentParams } from "../../mandelbrot";

export const POI = () => {
  const { poiList, addPOI, deletePOIAt, applyPOI } = usePOI();

  return (
    <ScrollArea h={500} offsetScrollbars>
      <Container pl="0">
        <Group position="right" mb="xs">
          <Button
            variant="default"
            leftIcon={<IconCirclePlus />}
            onClick={() => addPOI(cloneParams(getCurrentParams()))}
          >
            Save POI
          </Button>
        </Group>
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
      </Container>
    </ScrollArea>
  );
};

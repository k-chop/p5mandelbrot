import { ActionIcon, Button, Group, ScrollArea } from "@mantine/core";
import { POICard } from "./poi-card";
import { IconCirclePlus } from "@tabler/icons-react";

export const POI = () => {
  return (
    <ScrollArea.Autosize mah={500}>
      <Group position="right" mb="xs">
        <Button variant="default" leftIcon={<IconCirclePlus />}>
          Save POI
        </Button>
      </Group>
      <POICard />
    </ScrollArea.Autosize>
  );
};

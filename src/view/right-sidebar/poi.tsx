import {
  ActionIcon,
  Button,
  Container,
  Group,
  ScrollArea,
  Stack,
} from "@mantine/core";
import { POICard } from "./poi-card";
import { IconCirclePlus } from "@tabler/icons-react";

export const POI = () => {
  return (
    <ScrollArea h={500} offsetScrollbars>
      <Container pl="0">
        <Group position="right" mb="xs">
          <Button variant="default" leftIcon={<IconCirclePlus />}>
            Save POI
          </Button>
        </Group>
        <Stack>
          <POICard />
        </Stack>
      </Container>
    </ScrollArea>
  );
};

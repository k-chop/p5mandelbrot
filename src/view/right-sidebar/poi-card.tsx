import { Card, Group, ActionIcon, Text } from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowBigLeftLine,
  IconTrash,
} from "@tabler/icons-react";

export const POICard = () => {
  return (
    <Card shadow="sm" radius="md">
      <Group position="apart">
        <Text>centerX</Text>
        <Text>-1.4086723693666983695</Text>
      </Group>
      <Group position="apart">
        <Text>centerY</Text>
        <Text>0.13573367440664611575</Text>
      </Group>
      <Group position="apart">
        <Text>r</Text>
        <Text>0.000003637978807</Text>
      </Group>
      <Group position="apart" mt="xs">
        <ActionIcon size="md" radius="md" variant="filled">
          <IconArrowBigLeftLine />
        </ActionIcon>
        <ActionIcon size="md" radius="md" variant="filled">
          <IconTrash />
        </ActionIcon>
      </Group>
    </Card>
  );
};

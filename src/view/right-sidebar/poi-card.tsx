import { Card, Group, ActionIcon, Text } from "@mantine/core";
import { IconArrowBigLeftLine, IconTrash } from "@tabler/icons-react";
import { MandelbrotParams } from "../../types";

type POICardProps = {
  poi: MandelbrotParams;
  onDelete: () => void;
  onApply: () => void;
};

export const POICard = ({ poi, onDelete, onApply }: POICardProps) => {
  const { x, y, r } = poi;

  // TODO: できればbackgroundImageで画像のプレビューを表示したい

  return (
    <Card shadow="sm" radius="md">
      <Group position="apart">
        <Text>centerX</Text>
        <Text>{x.toPrecision(10)}</Text>
      </Group>
      <Group position="apart">
        <Text>centerY</Text>
        <Text>{y.toPrecision(10)}</Text>
      </Group>
      <Group position="apart">
        <Text>r</Text>
        <Text>{r.toPrecision(10)}</Text>
      </Group>
      <Group position="apart" mt="xs">
        <ActionIcon size="md" radius="md" variant="filled" onClick={onApply}>
          <IconArrowBigLeftLine />
        </ActionIcon>
        <ActionIcon size="md" radius="md" variant="filled" onClick={onDelete}>
          <IconTrash />
        </ActionIcon>
      </Group>
    </Card>
  );
};

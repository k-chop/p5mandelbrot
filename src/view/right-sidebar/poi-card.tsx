import { Card, Group, ActionIcon, Text } from "@mantine/core";
import { IconArrowBigLeftLine, IconTrash } from "@tabler/icons-react";
import { MandelbrotParams } from "../../types";

type POICardProps = {
  poi: MandelbrotParams;
  onDelete: () => void;
  onApply: () => void;
};

export const POICard = ({ poi, onDelete, onApply }: POICardProps) => {
  const { r, N } = poi;

  // TODO: できればbackgroundImageで画像のプレビューを表示したい

  return (
    <Card shadow="sm" radius="md" padding="xs">
      <Group position="apart">
        <Text>r</Text>
        <Text>{r.toPrecision(10)}</Text>
      </Group>
      <Group position="apart">
        <Text>N</Text>
        <Text>{N.toFixed(0)}</Text>
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

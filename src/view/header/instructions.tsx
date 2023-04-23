import { Kbd, SimpleGrid, Text, Title } from "@mantine/core";

export const Instructions = () => {
  return (
    <div>
      <Title order={3} my="xs">
        Mouse
      </Title>
      <SimpleGrid cols={2} ml="xs" verticalSpacing="xs">
        <Text>Wheel</Text>
        <Text>Zoom</Text>

        <Text>Shift + Wheel</Text>
        <Text>Change center & Zoom</Text>

        <Text>Click</Text>
        <Text>Change center</Text>
      </SimpleGrid>

      <Title order={3} my="xs">
        Keys
      </Title>
      <SimpleGrid cols={2} ml="xs" verticalSpacing="xs">
        <Text>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
        </Text>
        <Text>Zoom</Text>

        <Text>
          <Kbd>1</Kbd>, <Kbd>2</Kbd>, <Kbd>3</Kbd>
        </Text>
        <Text>Change color scheme</Text>

        <Text>
          <Kbd>m</Kbd>
        </Text>
        <Text>Toggle mode</Text>

        <Text>
          <Kbd>r</Kbd>
        </Text>
        <Text>Reset r to 2.0</Text>

        <Text>
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </Text>
        <Text>Change max iteration (±100)</Text>

        <Text>
          <Kbd>Shift</Kbd> + <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </Text>
        <Text>Change max iteration wisely (maybe)</Text>

        <Text>
          <Kbd>9</Kbd>
        </Text>
        <Text>Reset iteration count to 10000</Text>

        <Text>
          <Kbd>0</Kbd>
        </Text>
        <Text>Reset iteration count to 500</Text>
      </SimpleGrid>
    </div>
  );
};

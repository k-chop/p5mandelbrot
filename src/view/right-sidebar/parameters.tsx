import { Container, Group, Table, Text } from "@mantine/core";
import { useStoreValue } from "../../store/store";

export const Parameters = () => {
  const centerX = useStoreValue("centerX");
  const centerY = useStoreValue("centerY");
  const mouseX = useStoreValue("mouseX");
  const mouseY = useStoreValue("mouseY");
  const r = useStoreValue("r");
  const N = useStoreValue("N");
  const iteration = useStoreValue("iteration");
  const mode = useStoreValue("mode");

  return (
    <Container w="100%">
      <Group position="apart">
        <Text>centerX</Text>
        <Text>{centerX}</Text>
      </Group>
      <Group position="apart">
        <Text>centerY</Text>
        <Text>{centerY}</Text>
      </Group>
      <Group position="apart">
        <Text>mouseX</Text>
        <Text>{mouseX}</Text>
      </Group>
      <Group position="apart">
        <Text>mouseY</Text>
        <Text>{mouseY}</Text>
      </Group>
      <Group position="apart">
        <Text>r</Text>
        <Text>{r}</Text>
      </Group>
      <Group position="apart">
        <Text>N</Text>
        <Text>{N}</Text>
      </Group>
      <Group position="apart">
        <Text>iteration</Text>
        <Text>{iteration}</Text>
      </Group>
      <Group position="apart">
        <Text>mode</Text>
        <Text>{mode}</Text>
      </Group>
    </Container>
  );
};

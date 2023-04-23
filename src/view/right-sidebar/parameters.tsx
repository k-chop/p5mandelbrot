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

  // TODO: たぶんrの値見て表示の精度を決めるべき
  return (
    <Container w="100%">
      <Group position="apart">
        <Text>centerX</Text>
        <Text>{centerX.toPrecision(20)}</Text>
      </Group>
      <Group position="apart">
        <Text>centerY</Text>
        <Text>{centerY.toPrecision(20)}</Text>
      </Group>
      <Group position="apart">
        <Text>mouseX</Text>
        <Text>{mouseX.minus(centerX).toPrecision(10)}</Text>
      </Group>
      <Group position="apart">
        <Text>mouseY</Text>
        <Text>{centerY.minus(mouseY).toPrecision(10)}</Text>
      </Group>
      <Group position="apart">
        <Text>r</Text>
        <Text>{r.toPrecision(10)}</Text>
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

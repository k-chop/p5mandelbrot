import { Container, Group, Table, Text } from "@mantine/core";
import { useStoreValue } from "../../store/store";
import { GLITCHED_POINT_ITERATION } from "../../mandelbrot";

export const Parameters = () => {
  const centerX = useStoreValue("centerX");
  const centerY = useStoreValue("centerY");
  const mouseX = useStoreValue("mouseX");
  const mouseY = useStoreValue("mouseY");
  const r = useStoreValue("r");
  const N = useStoreValue("N");
  const iteration = useStoreValue("iteration");
  const mode = useStoreValue("mode");

  const iterationString =
    iteration === GLITCHED_POINT_ITERATION.toString()
      ? "<<glitched>>"
      : iteration?.toString();

  // TODO: たぶんrの値見て表示の精度を決めるべき
  return (
    <Container w="100%">
      <Group position="apart">
        <Text>CenterX</Text>
        <Text>{centerX.toPrecision(20)}</Text>
      </Group>
      <Group position="apart">
        <Text>CenterY</Text>
        <Text>{centerY.toPrecision(20)}</Text>
      </Group>
      <Group position="apart">
        <Text>MouseX</Text>
        <Text>{mouseX.minus(centerX).toPrecision(10)}</Text>
      </Group>
      <Group position="apart">
        <Text>MouseY</Text>
        <Text>{centerY.minus(mouseY).toPrecision(10)}</Text>
      </Group>
      <Group position="apart">
        <Text>r</Text>
        <Text>{r.toPrecision(10)}</Text>
      </Group>
      <Group position="apart">
        <Text>MAX Iteration</Text>
        <Text>{N}</Text>
      </Group>
      <Group position="apart">
        <Text>Iteration at cursor</Text>
        <Text>{iterationString}</Text>
      </Group>
      <Group position="apart">
        <Text>Mode</Text>
        <Text>{mode}</Text>
      </Group>
    </Container>
  );
};

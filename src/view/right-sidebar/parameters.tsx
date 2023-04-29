import { Container, Group, Text, Tooltip } from "@mantine/core";
import { GLITCHED_POINT_ITERATION } from "../../mandelbrot";
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

  const iterationString =
    iteration === GLITCHED_POINT_ITERATION.toString()
      ? "<<glitched>>"
      : iteration?.toString();

  return (
    <>
      <Container w="100%">
        <Group position="apart">
          <Text>CenterX</Text>
          <Text>{centerX.toPrecision(10)}</Text>
        </Group>
        <Group position="apart">
          <Text>CenterY</Text>
          <Text>{centerY.toPrecision(10)}</Text>
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
    </>
  );
};

import { Modal, Text, TextInput } from "@mantine/core";
import { GLITCHED_POINT_ITERATION, setCurrentParams } from "../../mandelbrot";
import { useStoreValue } from "../../store/store";
import { useModalState } from "../modal/use-modal-state";
import { Card, CardContent } from "@/components/ui/card";

export const Parameters = () => {
  const [opened, { open, close }] = useModalState();

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
    <Card className="mx-2">
      <Modal
        opened={opened}
        onClose={close}
        withCloseButton={false}
        size="xs"
        centered
      >
        <TextInput
          data-autofocus
          label="Change MAX Iteration"
          defaultValue={N.toString()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const newN = parseInt(e.currentTarget.value);
              if (newN > 0) {
                setCurrentParams({
                  N: newN,
                });
                close();
              }
            }
          }}
        />
      </Modal>
      <CardContent className="px-2 py-2">
        <ul>
          <li className="flex justify-between">
            <Text>CenterX</Text>
            <Text>{centerX.toPrecision(10)}</Text>
          </li>
          <li className="flex justify-between">
            <Text>CenterY</Text>
            <Text>{centerY.toPrecision(10)}</Text>
          </li>
          <li className="flex justify-between">
            <Text>MouseX</Text>
            <Text>{mouseX.minus(centerX).toPrecision(10)}</Text>
          </li>
          <li className="flex justify-between">
            <Text>MouseY</Text>
            <Text>{centerY.minus(mouseY).toPrecision(10)}</Text>
          </li>
          <li className="flex justify-between">
            <Text>r</Text>
            <Text>{r.toPrecision(10)}</Text>
          </li>
          <li className="flex justify-between">
            <Text>MAX Iteration</Text>
            <Text onClick={open}>{N}</Text>
          </li>
          <li className="flex justify-between">
            <Text>Iteration at cursor</Text>
            <Text>{iterationString}</Text>
          </li>
          <li className="flex justify-between">
            <Text>Mode</Text>
            <Text>{mode}</Text>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
};

import { Modal, TextInput } from "@mantine/core";
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
            <div>CenterX</div>
            <div>{centerX.toPrecision(10)}</div>
          </li>
          <li className="flex justify-between">
            <div>CenterY</div>
            <div>{centerY.toPrecision(10)}</div>
          </li>
          <li className="flex justify-between">
            <div>MouseX</div>
            <div>{mouseX.minus(centerX).toPrecision(10)}</div>
          </li>
          <li className="flex justify-between">
            <div>MouseY</div>
            <div>{centerY.minus(mouseY).toPrecision(10)}</div>
          </li>
          <li className="flex justify-between">
            <div>r</div>
            <div>{r.toPrecision(10)}</div>
          </li>
          <li className="flex justify-between">
            <div>MAX Iteration</div>
            <div onClick={open}>{N}</div>
          </li>
          <li className="flex justify-between">
            <div>Iteration at cursor</div>
            <div>{iterationString}</div>
          </li>
          <li className="flex justify-between">
            <div>Mode</div>
            <div>{mode}</div>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
};

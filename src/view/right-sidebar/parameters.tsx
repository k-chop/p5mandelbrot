import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { GLITCHED_POINT_ITERATION, setCurrentParams } from "../../mandelbrot";
import { useStoreValue } from "../../store/store";
import { useModalState } from "../modal/use-modal-state";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertCircleIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/kbd";

export const Parameters = () => {
  const [opened, { close, toggle }] = useModalState();

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

  const isNotEnoughPrecision = mode === "normal" && r.isLessThan(1e-13);

  return (
    <Card className="mx-2">
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
            <Dialog open={opened} onOpenChange={toggle}>
              <DialogTrigger>
                <div>{N}</div>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>Change Max Iteration</DialogHeader>
                <Input
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
                ></Input>
              </DialogContent>
            </Dialog>
          </li>
          <li className="flex justify-between">
            <div>Iteration at cursor</div>
            <div>{iterationString}</div>
          </li>
          <li className="flex justify-between">
            <div>Mode</div>
            <div className="flex gap-1">
              {isNotEnoughPrecision && (
                <TooltipProvider>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger>
                      <AlertCircleIcon className="fill-destructive text-background" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div>Not enough precision.</div>
                      <div>
                        Switch to perturbation mode by <Kbd>m</Kbd> key.
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {mode}
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
};

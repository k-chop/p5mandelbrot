import { Kbd } from "@/components/kbd";
import { setCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { Card, CardContent } from "@/shadcn/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from "@/shadcn/components/ui/dialog";
import { Input } from "@/shadcn/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shadcn/components/ui/tooltip";
import { AlertCircleIcon } from "lucide-react";
import { useStoreValue } from "../../store/store";
import { useModalState } from "../modal/use-modal-state";

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

  const iterationString = iteration?.toString();

  const isNotEnoughPrecision = mode === "normal" && r.isLessThan(1e-13);

  return (
    <Card className="mx-2 min-w-64 max-w-80">
      <CardContent className="p-2">
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
          <li className="flex items-center justify-between">
            <div>Mode</div>
            <div className="flex gap-1">
              {isNotEnoughPrecision ? (
                <TooltipProvider>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger>
                      <div className="flex gap-1 rounded-md bg-destructive p-1 text-destructive-foreground">
                        <AlertCircleIcon className="fill-destructive text-destructive-foreground" />
                        {mode}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div>Not enough precision.</div>
                      <div>
                        Switch to perturbation mode by <Kbd>m</Kbd> key.
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <>{mode}</>
              )}
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
};

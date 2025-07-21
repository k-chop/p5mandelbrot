import { Button } from "@/shadcn/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/ui/dialog";
import { Label } from "@/shadcn/components/ui/label";
import { Switch } from "@/shadcn/components/ui/switch";
import { updateStoreWith, useStoreValue } from "@/store/store";
import { IconHelp } from "@tabler/icons-react";
import { useModalState } from "../modal/use-modal-state";
import { Actions } from "./actions";
import { Instructions } from "./instructions";

export const Header = () => {
  const [opened, { open, toggle }] = useModalState();
  const isDebugMode = useStoreValue("isDebugMode");

  const toggleDebugMode = () => updateStoreWith("isDebugMode", (v) => !v);

  return (
    <>
      <Dialog open={opened} onOpenChange={toggle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-3xl">Instructions</DialogTitle>
          </DialogHeader>
          <Instructions />
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-2">
        <Actions />
        <div className="col-end-7 flex items-center gap-1">
          <div className="flex items-center space-x-2 px-2">
            <Switch
              id="debug-mode"
              checked={isDebugMode}
              onCheckedChange={() => toggleDebugMode()}
            />
            <Label htmlFor="debug-mode">Debug Mode</Label>
          </div>
          <Button variant="outline" size="icon-sm" asChild>
            <a
              href="https://github.com/k-chop/p5mandelbrot"
              target="_blank"
              rel="noreferrer"
            >
              <img src="github-mark-white.svg" className="p-1" />
            </a>
          </Button>
          <Button variant="outline" size="icon-sm" onClick={open}>
            <IconHelp />
          </Button>
        </div>
      </div>
    </>
  );
};

import { Button } from "@/shadcn/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/ui/dialog";
import { IconHelp } from "@tabler/icons-react";
import { useModalState } from "../modal/use-modal-state";
import { Actions } from "./actions";
import { Instructions } from "./instructions";

export const Header = () => {
  const [opened, { open, toggle }] = useModalState();

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
          <Button variant="outline" size="icon-sm" asChild>
            <a
              href="https://github.com/k-chop/p5mandelbrot"
              target="_blank"
              rel="noreferrer"
            >
              <img src="/github-mark-white.svg" />
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

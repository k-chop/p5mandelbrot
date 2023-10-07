import { IconHelp, IconPin } from "@tabler/icons-react";
import { useModalState } from "../modal/use-modal-state";
import { Instructions } from "./instructions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStoreValue } from "@/store/store";
import { Kbd } from "@/components/kbd";

export const Header = () => {
  const [opened, { open, toggle }] = useModalState();
  const isReferencePinned = useStoreValue("isReferencePinned");

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
      <div className="mt-2 grid grid-cols-2">
        <div>
          {isReferencePinned && (
            <div className="flex gap-1 border-b-2 border-destructive">
              <IconPin /> Reference Point Pinned (Press <Kbd>p</Kbd> to unpin)
            </div>
          )}
        </div>
        <div className="col-end-7 flex items-center gap-1">
          <Button variant="outline" size="icon-sm" asChild>
            <a href="https://github.com/k-chop/p5mandelbrot" target="_blank">
              <img src="public/github-mark-white.svg" />
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

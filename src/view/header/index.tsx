import { IconHelp } from "@tabler/icons-react";
import { useModalState } from "../modal/use-modal-state";
import { Instructions } from "./instructions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
        <div>Header</div>
        <div className="col-end-7">
          <Button variant="outline" size="icon-sm" onClick={open}>
            <IconHelp />
          </Button>
        </div>
      </div>
    </>
  );
};

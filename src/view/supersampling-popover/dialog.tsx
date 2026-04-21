import { useT } from "@/i18n/context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { SupersamplingForm } from "./form";

/** スーパーサンプリング設定ダイアログ (モバイル用) */
export const SupersamplingDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Supersampling x2", "header.supersamplingX2")}</DialogTitle>
        </DialogHeader>
        <SupersamplingForm />
      </DialogContent>
    </Dialog>
  );
};

import { Button } from "@/shadcn/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { toast } from "@/shadcn/hooks/use-toast";
import type { ShareData } from "@/utils/mandelbrot-url-params";
import { ClickFeedback, useClickFeedback } from "@/view/components/click-feedback";
import { useT } from "@/i18n/context";
import { IconCircleCheck, IconCopy, IconPhoto } from "@tabler/icons-react";

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareData: ShareData;
  imageDataUrl: string | null;
  showCopyImage?: boolean;
};

export const ShareDialog = ({
  open,
  onOpenChange,
  shareData,
  imageDataUrl,
  showCopyImage = true,
}: ShareDialogProps) => {
  const t = useT();
  const copyAllFeedback = useClickFeedback();
  const copyUrlImageFeedback = useClickFeedback();
  const copyUrlFeedback = useClickFeedback();

  if (!open) return null;

  const handleCopyAll = async () => {
    const text = `x: ${shareData.x}\ny: ${shareData.y}\nr: ${shareData.r}\nN: ${shareData.N}\n${shareData.url}`;
    try {
      if (showCopyImage && imageDataUrl) {
        const res = await fetch(imageDataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "image/png": blob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      copyAllFeedback.trigger();
    } catch {
      toast({
        description: t("Failed to copy to clipboard", "share.copyFailed"),
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleCopyUrlAndImage = async () => {
    try {
      if (imageDataUrl) {
        const res = await fetch(imageDataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([shareData.url], { type: "text/plain" }),
            "image/png": blob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(shareData.url);
      }
      copyUrlImageFeedback.trigger();
    } catch {
      toast({
        description: t("Failed to copy to clipboard", "share.copyFailed"),
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Share", "header.share")}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="shrink-0">
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt="Mandelbrot preview"
                className="h-50 rounded border object-contain"
              />
            ) : (
              <div className="flex h-50 w-50 items-center justify-center rounded border bg-muted text-muted-foreground">
                {t("No preview")}
              </div>
            )}
          </div>

          <div className="flex w-0 grow flex-col justify-center gap-1 font-mono text-sm">
            <div className="truncate">
              <span className="text-muted-foreground">x: </span>
              {shareData.x}
            </div>
            <div className="truncate">
              <span className="text-muted-foreground">y: </span>
              {shareData.y}
            </div>
            <div className="truncate">
              <span className="text-muted-foreground">r: </span>
              {shareData.r}
            </div>
            <div>
              <span className="text-muted-foreground">N: </span>
              {shareData.N}
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          <input
            type="text"
            readOnly
            value={shareData.url}
            className="box-border min-w-0 flex-1 overflow-hidden text-ellipsis rounded border bg-muted px-2 py-1 font-mono text-xs"
            onFocus={(e) => e.target.select()}
          />
          <ClickFeedback
            open={copyUrlFeedback.open}
            content={
              <div className="flex items-center gap-1">
                <IconCircleCheck className="size-4" />
                {t("Copied!")}
              </div>
            }
          >
            <Button
              variant="outline"
              size="icon"
              className="size-7 shrink-0"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareData.url);
                  copyUrlFeedback.trigger();
                } catch {
                  toast({
                    description: t("Failed to copy to clipboard", "share.copyFailed"),
                    variant: "destructive",
                    duration: 3000,
                  });
                }
              }}
            >
              <IconCopy className="size-3.5" />
            </Button>
          </ClickFeedback>
        </div>

        <div className="flex min-w-0 gap-2">
          <ClickFeedback
            open={copyAllFeedback.open}
            content={
              <div className="flex items-center gap-1">
                <IconCircleCheck className="size-4" />
                {t("Copied!")}
              </div>
            }
          >
            <Button variant="outline" size="sm" className="min-w-0 flex-1" onClick={handleCopyAll}>
              <IconCopy className="mr-1 size-4 shrink-0" />
              {t("Copy All")}
            </Button>
          </ClickFeedback>
          {showCopyImage && (
            <ClickFeedback
              open={copyUrlImageFeedback.open}
              content={
                <div className="flex items-center gap-1">
                  <IconCircleCheck className="size-4" />
                  {t("Copied!")}
                </div>
              }
            >
              <Button
                variant="outline"
                size="sm"
                className="min-w-0 flex-1"
                onClick={handleCopyUrlAndImage}
              >
                <IconPhoto className="mr-1 size-4 shrink-0" />
                <span className="truncate">{t("Copy URL & Image")}</span>
              </Button>
            </ClickFeedback>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

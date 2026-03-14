import { Button } from "@/shadcn/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { toast } from "@/shadcn/hooks/use-toast";
import { buildShareData } from "@/utils/mandelbrot-url-params";
import { IconCircleCheck, IconCopy, IconPhoto } from "@tabler/icons-react";

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageDataUrl: string | null;
};

export const ShareDialog = ({ open, onOpenChange, imageDataUrl }: ShareDialogProps) => {
  if (!open) return null;

  const shareData = buildShareData();

  const handleCopyAll = async () => {
    const text = `x: ${shareData.x}\ny: ${shareData.y}\nr: ${shareData.r}\nN: ${shareData.N}\n${shareData.url}`;
    try {
      if (imageDataUrl) {
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
      toast({
        description: (
          <div className="flex items-center justify-center gap-2">
            <IconCircleCheck />
            Copied to clipboard!
          </div>
        ),
        variant: "primary",
        duration: 2000,
      });
    } catch {
      toast({
        description: "Failed to copy to clipboard",
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
      toast({
        description: (
          <div className="flex items-center justify-center gap-2">
            <IconCircleCheck />
            URL & image copied to clipboard!
          </div>
        ),
        variant: "primary",
        duration: 2000,
      });
    } catch {
      toast({
        description: "Failed to copy to clipboard",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden *:min-w-0">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
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
                No preview
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-1 overflow-hidden font-mono text-sm">
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

        <input
          type="text"
          readOnly
          value={shareData.url}
          className="box-border w-full overflow-hidden text-ellipsis rounded border bg-muted px-2 py-1 font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />

        <div className="flex min-w-0 gap-2">
          <Button variant="outline" size="sm" className="min-w-0 flex-1" onClick={handleCopyAll}>
            <IconCopy className="mr-1 size-4 shrink-0" />
            Copy All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1"
            onClick={handleCopyUrlAndImage}
          >
            <IconPhoto className="mr-1 size-4 shrink-0" />
            <span className="truncate">Copy URL & Image</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

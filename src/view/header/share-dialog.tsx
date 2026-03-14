import { getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { Button } from "@/shadcn/components/ui/button";
import { toast } from "@/shadcn/hooks/use-toast";
import { buildCurrentParamsUrl } from "@/utils/mandelbrot-url-params";
import { IconCircleCheck, IconCopy, IconPhoto } from "@tabler/icons-react";

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageDataUrl: string | null;
};

export const ShareDialog = ({ open, onOpenChange, imageDataUrl }: ShareDialogProps) => {
  if (!open) return null;

  const { x, y, r, N } = getCurrentParams();
  const shareUrl = buildCurrentParamsUrl();

  const handleCopyText = () => {
    void navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        description: (
          <div className="flex items-center justify-center gap-2">
            <IconCircleCheck />
            URL copied to clipboard!
          </div>
        ),
        variant: "primary",
        duration: 2000,
      });
    });
  };

  const handleCopyImage = async () => {
    if (!imageDataUrl) return;
    try {
      const res = await fetch(imageDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast({
        description: (
          <div className="flex items-center justify-center gap-2">
            <IconCircleCheck />
            Image copied to clipboard!
          </div>
        ),
        variant: "primary",
        duration: 2000,
      });
    } catch {
      toast({
        description: "Failed to copy image to clipboard",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="shrink-0">
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt="Mandelbrot preview"
                className="h-[200px] rounded border object-contain"
              />
            ) : (
              <div className="flex h-[200px] w-[200px] items-center justify-center rounded border bg-muted text-muted-foreground">
                No preview
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-1 overflow-hidden font-mono text-sm">
            <div className="truncate">
              <span className="text-muted-foreground">x: </span>
              {x.toPrecision(10)}
            </div>
            <div className="truncate">
              <span className="text-muted-foreground">y: </span>
              {y.toPrecision(10)}
            </div>
            <div className="truncate">
              <span className="text-muted-foreground">r: </span>
              {r.toPrecision(3)}
            </div>
            <div>
              <span className="text-muted-foreground">N: </span>
              {N}
            </div>
          </div>
        </div>

        <input
          type="text"
          readOnly
          value={shareUrl}
          className="w-full overflow-hidden rounded border bg-muted px-2 py-1 font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleCopyImage}>
            <IconPhoto className="mr-1 size-4" />
            Copy Image
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={handleCopyText}>
            <IconCopy className="mr-1 size-4" />
            Copy URL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { getResizedCanvasImageDataURL } from "@/p5-adapter/p5-adapter";
import { copyCurrentParamsToClipboard } from "@/utils/mandelbrot-url-params";
import { IconCircleCheck, IconDownload, IconShare } from "@tabler/icons-react";

export const Actions = () => {
  return (
    <div className="flex gap-x-2">
      <ShareButton />
      <SaveImageButton />
    </div>
  );
};

const ShareButton = () => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        copyCurrentParamsToClipboard();

        toast({
          description: (
            <div className="flex items-center justify-center gap-2">
              <IconCircleCheck />
              Current location URL copied to clipboard!
            </div>
          ),
          variant: "primary",
          duration: 2000,
        });
      }}
    >
      <IconShare className="mr-1 size-6" />
      Share
    </Button>
  );
};

const SaveImageButton = () => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const imageDataURL = getResizedCanvasImageDataURL(0);
        const link = document.createElement("a");
        link.download = `mandelbrot-${Date.now()}.png`;
        link.href = imageDataURL;
        link.click();

        toast({
          description: (
            <div className="flex items-center justify-center gap-2">
              <IconCircleCheck />
              Image saved!
            </div>
          ),
          variant: "primary",
          duration: 2000,
        });
      }}
    >
      <IconDownload className="mr-1 size-6" />
      Save Image
    </Button>
  );
};

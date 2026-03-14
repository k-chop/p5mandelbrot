import { setCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { getResizedCanvasImageDataURL, requestShareImage } from "@/p5-adapter/p5-adapter";
import { Button } from "@/shadcn/components/ui/button";
import { toast } from "@/shadcn/hooks/use-toast";
import { useModalState } from "@/view/modal/use-modal-state";
import { IconCircleCheck, IconDownload, IconShare } from "@tabler/icons-react";
import { Expand } from "lucide-react";
import { useEffect, useState } from "react";
import { ShareDialog } from "./share-dialog";

export const Actions = () => {
  return (
    <div className="flex gap-x-2">
      <ShareButton />
      <SaveImageButton />
      <SupersamplingButton />
    </div>
  );
};

const ShareButton = () => {
  const [opened, { open, close }] = useModalState();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      requestShareImage(200, (dataUrl) => {
        setImageDataUrl(dataUrl);
      });
    }
  }, [opened]);

  return (
    <>
      <ShareDialog
        open={opened}
        onOpenChange={(isOpen) => {
          if (!isOpen) close();
        }}
        imageDataUrl={imageDataUrl}
      />
      <Button variant="outline" size="sm" onClick={open}>
        <IconShare className="mr-1 size-6" />
        Share
      </Button>
    </>
  );
};

const SaveImageButton = () => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const imageDataURL = getResizedCanvasImageDataURL(0, true);
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

const SupersamplingButton = () => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setCurrentParams({ isSuperSampling: true });
      }}
    >
      <Expand className="mr-1 size-6" />
      Supersampling x2
    </Button>
  );
};

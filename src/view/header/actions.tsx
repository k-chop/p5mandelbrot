import { getCurrentPalette } from "@/camera/palette";
import { getCurrentParams, setCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { getResizedCanvasImageDataURL, requestCanvasImage } from "@/p5-adapter/p5-adapter";
import { getCanvasSize } from "@/rendering/renderer";
import { Button } from "@/shadcn/components/ui/button";
import { Label } from "@/shadcn/components/ui/label";
import { Switch } from "@/shadcn/components/ui/switch";
import { toast } from "@/shadcn/hooks/use-toast";
import { updateStoreWith, useStoreValue } from "@/store/store";
import { buildShareData } from "@/utils/mandelbrot-url-params";
import { useModalState } from "@/view/modal/use-modal-state";
import { IconCircleCheck, IconDownload, IconShare } from "@tabler/icons-react";
import { Expand } from "lucide-react";
import { useEffect, useState } from "react";
import { ShareDialog } from "./share-dialog";

export const Actions = () => {
  return (
    <div className="flex items-center gap-x-2">
      <ShareButton />
      <SaveImageButton />
      <SupersamplingButton />
      <InterestingPointsToggle />
    </div>
  );
};

/** 興味深いポイントマーカーの表示切り替えスイッチ */
const InterestingPointsToggle = () => {
  const show = useStoreValue("showInterestingPoints");
  return (
    <div className="flex items-center space-x-2 px-2">
      <Switch
        id="interesting-points"
        checked={show}
        onCheckedChange={() => updateStoreWith("showInterestingPoints", (v) => !v)}
      />
      <Label htmlFor="interesting-points">Show point marker</Label>
    </div>
  );
};

const ShareButton = () => {
  const [opened, { open, close }] = useModalState();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      requestCanvasImage(getCanvasSize().height, (dataUrl) => {
        setImageDataUrl(dataUrl);
      });
    }
  }, [opened]);

  const shareData = opened
    ? buildShareData({
        ...getCurrentParams(),
        palette: getCurrentPalette(),
        canvasWidth: getCanvasSize().width,
      })
    : { url: "", x: "", y: "", r: "", N: 0 };

  return (
    <>
      <ShareDialog
        open={opened}
        onOpenChange={(isOpen) => {
          if (!isOpen) close();
        }}
        shareData={shareData}
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

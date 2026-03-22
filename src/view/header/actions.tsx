import { getCurrentPalette } from "@/camera/palette";
import { SimpleTooltip } from "@/components/simple-tooltip";
import { useT } from "@/i18n/context";
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
  const t = useT();
  return (
    <SimpleTooltip
      content={
        <>
          {t("Marks interesting points on the fractal.")}
          <br />
          {t("Click a marker to zoom into its center.")}
        </>
      }
    >
      <div className="flex items-center space-x-2 px-2">
        <Switch
          id="interesting-points"
          checked={show}
          onCheckedChange={() => updateStoreWith("showInterestingPoints", (v) => !v)}
        />
        <Label htmlFor="interesting-points">{t("Show point marker")}</Label>
      </div>
    </SimpleTooltip>
  );
};

const ShareButton = () => {
  const t = useT();
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
        {t("Share", "header.share")}
      </Button>
    </>
  );
};

const SaveImageButton = () => {
  const t = useT();
  return (
    <SimpleTooltip content={t("Downloads the canvas content as a PNG image.")}>
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
                {t("Image saved!")}
              </div>
            ),
            variant: "primary",
            duration: 2000,
          });
        }}
      >
        <IconDownload className="mr-1 size-6" />
        {t("Save Image")}
      </Button>
    </SimpleTooltip>
  );
};

const SupersamplingButton = () => {
  const t = useT();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setCurrentParams({ isSuperSampling: true });
      }}
    >
      <Expand className="mr-1 size-6" />
      {t("Supersampling x2")}
    </Button>
  );
};

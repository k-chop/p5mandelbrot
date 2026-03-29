import { getCurrentPalette, setSerializedPalette } from "@/camera/palette";
import { SimpleTooltip } from "@/components/simple-tooltip";
import { useT } from "@/i18n/context";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import {
  getCurrentParams,
  setCurrentParams,
  setManualN,
} from "@/mandelbrot-state/mandelbrot-state";
import { requestCanvasImage } from "@/p5-adapter/p5-adapter";
import { getRandomPresetPOI } from "@/preset-poi/preset-poi";
import { getCanvasSize } from "@/rendering/renderer";
import { Button } from "@/shadcn/components/ui/button";
import { Label } from "@/shadcn/components/ui/label";
import { Switch } from "@/shadcn/components/ui/switch";
import { toast } from "@/shadcn/hooks/use-toast";
import { updateStoreWith, useStoreValue } from "@/store/store";
import { buildShareData } from "@/utils/mandelbrot-url-params";
import { useModalState } from "@/view/modal/use-modal-state";
import { IconCircleCheck, IconDice, IconDownload, IconShare } from "@tabler/icons-react";
import BigNumber from "bignumber.js";
import { Expand } from "lucide-react";
import { useEffect, useState } from "react";
import { ShareDialog } from "./share-dialog";

export const Actions = () => {
  return (
    <div className="flex items-center gap-x-2">
      <RandomJumpButton />
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
          requestCanvasImage(0, (imageDataURL) => {
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
          });
        }}
      >
        <IconDownload className="mr-1 size-6" />
        {t("Save Image")}
      </Button>
    </SimpleTooltip>
  );
};

/** プリセットPOIからランダムに1件選んでジャンプするボタン */
const RandomJumpButton = () => {
  const t = useT();

  const handleClick = () => {
    const raw = getRandomPresetPOI();
    setManualN(raw.N);
    setCurrentParams({
      x: new BigNumber(raw.x),
      y: new BigNumber(raw.y),
      r: new BigNumber(raw.r),
      N: raw.N,
      mode: raw.mode,
    });
    clearIterationCache();
    setSerializedPalette(raw.palette);
  };

  return (
    <SimpleTooltip content={t("Jump to a random preset point of interest.")}>
      <Button variant="default" size="sm" onClick={handleClick}>
        <IconDice className="mr-1 size-6" />
        {t("Random Jump")}
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

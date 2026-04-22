import { getCurrentPalette, setSerializedPalette } from "@/camera/palette";
import { SimpleTooltip } from "@/components/simple-tooltip";
import { type TFunction, useT } from "@/i18n/context";
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
import { toast } from "sonner";
import { buildShareData, type ShareData } from "@/utils/mandelbrot-url-params";
import { SupersamplingPopover } from "@/view/supersampling-popover";
import { IconDice, IconDownload, IconShare } from "@tabler/icons-react";
import BigNumber from "bignumber.js";
import { useEffect, useState } from "react";
import { ShareDialog } from "./share-dialog";

/** 空のshareData */
const EMPTY_SHARE_DATA: ShareData = { url: "", x: "", y: "", r: "", N: 0 };

/**
 * Shareダイアログを制御するための状態・副作用を管理するフック
 *
 * opened=true になった瞬間にcanvas画像をキャプチャし、imageDataUrlとshareDataを
 * 返す。ShareDialogにそのまま渡せる。
 */
export const useShareDialogState = (opened: boolean) => {
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
      })
    : EMPTY_SHARE_DATA;

  return { imageDataUrl, shareData };
};

/**
 * ShareDialogを外部stateでホストする薄いラッパー
 */
export const ShareDialogHost = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { imageDataUrl, shareData } = useShareDialogState(open);
  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      shareData={shareData}
      imageDataUrl={imageDataUrl}
    />
  );
};

/**
 * キャンバス画像をPNGとしてダウンロードする
 */
export const performSaveImage = (t: TFunction) => {
  requestCanvasImage(0, (imageDataURL) => {
    const link = document.createElement("a");
    link.download = `mandelbrot-${Date.now()}.png`;
    link.href = imageDataURL;
    link.click();

    toast.success(t("Image saved!"), {
      duration: 2000,
    });
  });
};

/**
 * プリセットPOIからランダムに1件選んでジャンプする
 */
export const performRandomJump = () => {
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

/**
 * I'm Feeling Luckyボタン (プリセットPOIからランダムにジャンプ)
 */
export const RandomJumpButton = () => {
  const t = useT();

  return (
    <SimpleTooltip content={t("Dive into a hidden gem of the Mandelbrot set.")}>
      <Button variant="default" size="sm" onClick={performRandomJump}>
        <IconDice className="mr-1 size-6" />
        {t("I'm Feeling Lucky")}
      </Button>
    </SimpleTooltip>
  );
};

/**
 * Shareダイアログを開くボタン (onClickでダイアログopen)
 */
export const ShareButton = ({ onClick }: { onClick: () => void }) => {
  const t = useT();
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <IconShare className="mr-1 size-6" />
      {t("Share", "header.share")}
    </Button>
  );
};

/**
 * 画像保存ボタン
 */
export const SaveImageButton = () => {
  const t = useT();
  return (
    <SimpleTooltip content={t("Downloads the canvas content as a PNG image.")}>
      <Button variant="outline" size="sm" onClick={() => performSaveImage(t)}>
        <IconDownload className="mr-1 size-6" />
        {t("Save Image")}
      </Button>
    </SimpleTooltip>
  );
};

/**
 * デスクトップ用のアクション群 (Lucky / Share / Save / Supersampling)
 */
export const Actions = ({ onOpenShare }: { onOpenShare: () => void }) => {
  return (
    <div className="flex items-center gap-x-2">
      <RandomJumpButton />
      <ShareButton onClick={onOpenShare} />
      <SaveImageButton />
      <SupersamplingPopover />
    </div>
  );
};

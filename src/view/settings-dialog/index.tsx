import { ValueSlider } from "@/components/slider-wrapper";
import { useT } from "@/i18n/context";
import { resizeTo } from "@/p5-adapter/p5-adapter";
import type { RendererType } from "@/rendering/common";
import {
  getRenderer,
  isWebGPUInitialized,
  isWebGPUSupported,
  setRenderer,
} from "@/rendering/common";
import { Button } from "@/shadcn/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/ui/dialog";
import { Label } from "@/shadcn/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shadcn/components/ui/radio-group";
import { Switch } from "@/shadcn/components/ui/switch";
import { toast } from "sonner";
import { updateStore, updateStoreWith, useStoreValue } from "@/store/store";
import { DEFAULT_WORKER_COUNT } from "@/store/sync-storage/settings";
import { useIsMobile } from "@/view/use-is-mobile";
import { prepareWorkerPool } from "@/worker-pool/pool-instance";
import { IconHelp, IconSettings } from "@tabler/icons-react";
import { VisuallyHidden } from "radix-ui";
import { useEffect, useState } from "react";
import { Instructions } from "../header/instructions";
import { useModalState } from "../modal/use-modal-state";

/** セクション見出し */
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
    {children}
  </h3>
);

/** 設定項目の補足説明 (項目直下に小さい文字で常時表示) */
const FieldDescription = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 text-xs text-muted-foreground">{children}</p>
);

/** Worker数の選択肢を生成 */
const createWorkerCountValues = () => {
  const base = DEFAULT_WORKER_COUNT;
  const counts = [base / 8, base / 4, base / 2, base, base * 2, base * 4, base * 8].map(Math.ceil);
  const distinctCounts = [...new Set([1, ...counts])];
  distinctCounts.sort((a, b) => a - b);
  return distinctCounts.map((count) => count.toString());
};

const zoomRateValues = ["1.2", "1.5", "2.0", "4.0", "6.0", "10", "50", "100"];
const workerCountValues = createWorkerCountValues();
const maxCanvasSizeValues = ["-1", "128", "256", "512", "800", "1024", "2048"];

/** 左カラム: Rendering セクション */
const RenderingSection = () => {
  const t = useT();
  const workerCount = useStoreValue("workerCount");
  const maxCanvasSize = useStoreValue("maxCanvasSize");
  const useWasm = useStoreValue("useWasm");

  const [webGPUSupported, setWebGPUSupported] = useState(false);
  const [rendererType, setRendererType] = useState<RendererType>("p5js");
  const [workerCountPreview, setWorkerCountPreview] = useState(workerCount);
  const [maxCanvasSizePreview, setMaxCanvasSizePreview] = useState(maxCanvasSize);

  useEffect(() => {
    setWebGPUSupported(isWebGPUSupported() && isWebGPUInitialized());
    setRendererType(getRenderer());
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Rendering</SectionTitle>

      {webGPUSupported && (
        <div>
          <div className="mb-2 ml-2 text-sm">{t("Renderer Type")}</div>
          <RadioGroup
            value={rendererType}
            onValueChange={(value: RendererType) => {
              setRendererType(value);
              setRenderer(value);
              toast.success(
                value === "webgpu"
                  ? t("Switched to WebGPU renderer")
                  : t("Switched to P5.js renderer"),
                { duration: 3000 },
              );
            }}
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="webgpu" id="settings-webgpu" />
              <Label htmlFor="settings-webgpu" className="cursor-pointer text-sm">
                {t("WebGPU (Faster)")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="p5js" id="settings-p5js" />
              <Label htmlFor="settings-p5js" className="cursor-pointer text-sm">
                {t("P5.js (Compatible)")}
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      <div>
        <div className="flex items-center space-x-2">
          <Switch
            id="settings-use-wasm"
            checked={useWasm}
            onCheckedChange={() => updateStoreWith("useWasm", (v) => !v)}
          />
          <Label htmlFor="settings-use-wasm" className="cursor-pointer text-sm">
            {t("Use Wasm for reference orbit")}
          </Label>
        </div>
        <FieldDescription>
          {t("Approximately 10x faster. Recommended to keep ON.")}
        </FieldDescription>
      </div>

      <div>
        <div className="mb-1 ml-2 text-sm">
          {t("Max Canvas Size")}: {maxCanvasSizePreview}
        </div>
        <ValueSlider<number>
          values={maxCanvasSizeValues}
          defaultValue={maxCanvasSize}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => setMaxCanvasSizePreview(value)}
          onValueCommit={(value) => {
            updateStore("maxCanvasSize", value);
            resizeTo();
          }}
        />
      </div>

      <div>
        <div className="mb-1 ml-2 text-sm">
          {t("Worker Count")}: {workerCountPreview}
        </div>
        <ValueSlider<number>
          values={workerCountValues}
          defaultValue={workerCount}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => setWorkerCountPreview(value)}
          onValueCommit={(value) => {
            updateStore("workerCount", value);
            void prepareWorkerPool();
          }}
        />
      </div>
    </div>
  );
};

/** 右カラム: Exploration セクション */
const ExplorationSection = () => {
  const t = useT();
  const isMobile = useIsMobile();
  const zoomRate = useStoreValue("zoomRate");
  const show = useStoreValue("showInterestingPoints");
  const [zoomRatePreview, setZoomRatePreview] = useState(zoomRate);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Exploration</SectionTitle>

      <div>
        <div className="mb-1 ml-2 text-sm">
          {t("Zoom Rate")}: x{zoomRatePreview}
        </div>
        <ValueSlider<number>
          values={zoomRateValues}
          defaultValue={zoomRate}
          valueConverter={(value) => parseFloat(value)}
          onValueChange={(value) => setZoomRatePreview(value)}
          onValueCommit={(value) => updateStore("zoomRate", value)}
        />
      </div>

      {/* モバイルでは point marker は常に非表示なので設定項目も隠す */}
      {!isMobile && (
        <div>
          <div className="flex items-center space-x-2">
            <Switch
              id="settings-interesting-points"
              checked={show}
              onCheckedChange={() => updateStoreWith("showInterestingPoints", (v) => !v)}
            />
            <Label htmlFor="settings-interesting-points" className="cursor-pointer text-sm">
              {t("Show point marker")}
            </Label>
          </div>
          <FieldDescription>
            {t("Marks interesting points on the fractal.")}
            <br />
            {t("Click a marker to zoom into its center.")}
          </FieldDescription>
        </div>
      )}
    </div>
  );
};

/** 右カラム: About セクション */
const AboutSection = () => {
  const t = useT();
  const locale = useStoreValue("locale");
  const isDebugMode = useStoreValue("isDebugMode");
  const [instructionsOpened, { open: openInstructions, toggle: toggleInstructions }] =
    useModalState();

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>About</SectionTitle>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href="https://github.com/k-chop/p5mandelbrot" target="_blank" rel="noreferrer">
            <img src="github-mark-white.svg" className="mr-1 size-4" />
            GitHub
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={openInstructions}>
          <IconHelp className="mr-1 size-4" />
          {t("Instructions")}
        </Button>
      </div>

      <Dialog open={instructionsOpened} onOpenChange={toggleInstructions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-3xl">{t("Instructions")}</DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>
                {t("Usage instructions", "dialog.description.instructions")}
              </DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>
          <Instructions />
        </DialogContent>
      </Dialog>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateStore("locale", locale === "en" ? "ja" : "en")}
        >
          {locale === "en" ? "JA" : "EN"}
        </Button>
        <Label className="text-sm text-muted-foreground">
          {locale === "en" ? "English" : "日本語"}
        </Label>
      </div>

      <div>
        <div className="flex items-center space-x-2">
          <Switch
            id="settings-debug-mode"
            checked={isDebugMode}
            onCheckedChange={() => updateStoreWith("isDebugMode", (v) => !v)}
          />
          <Label htmlFor="settings-debug-mode" className="cursor-pointer text-sm">
            {t("Debug Mode")}
          </Label>
        </div>
        <FieldDescription>
          {t("Shows debug data obtained from rendering results.")}
        </FieldDescription>
      </div>
    </div>
  );
};

/** 設定ダイアログ（ツールバーの⚙ボタンから開く） */
export const SettingsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto md:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSettings className="size-5" />
            {t("Settings", "operations.settings")}
          </DialogTitle>
          <VisuallyHidden.Root>
            <DialogDescription>
              {t("Application settings", "dialog.description.settings")}
            </DialogDescription>
          </VisuallyHidden.Root>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-8 pt-2 md:grid-cols-2">
          <div className="flex flex-col gap-8">
            <RenderingSection />
          </div>
          <div className="flex flex-col gap-8">
            <ExplorationSection />
            <AboutSection />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

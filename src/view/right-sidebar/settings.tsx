import { ValueSlider } from "@/components/slider-wrapper";
import { resizeTo } from "@/p5-adapter/p5-adapter";
import type { RendererType } from "@/rendering/common";
import {
  getRenderer,
  isWebGPUInitialized,
  isWebGPUSupported,
  setRenderer,
} from "@/rendering/common";
import { Button } from "@/shadcn/components/ui/button";
import { Label } from "@/shadcn/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shadcn/components/ui/radio-group";
import { useToast } from "@/shadcn/hooks/use-toast";
import { readPOIListFromClipboard } from "@/store/sync-storage/poi-list";
import { prepareWorkerPool } from "@/worker-pool/pool-instance";
import { IconCircleCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { getStore, updateStore, useStoreValue } from "../../store/store";
import { DEFAULT_WORKER_COUNT } from "../../store/sync-storage/settings";

const createWorkerCountValues = () => {
  const base = DEFAULT_WORKER_COUNT;
  const counts = [base / 8, base / 4, base / 2, base, base * 2, base * 4, base * 8].map(Math.ceil);
  const distinctCounts = [...new Set([1, ...counts])];
  distinctCounts.sort((a, b) => a - b);

  return distinctCounts.map((count) => count.toString());
};

export const Settings = () => {
  const { toast } = useToast();

  const zoomRate = useStoreValue("zoomRate");
  const workerCount = useStoreValue("workerCount");
  const maxCanvasSize = useStoreValue("maxCanvasSize");
  const supersamplingWidth = useStoreValue("supersamplingWidth");
  const supersamplingHeight = useStoreValue("supersamplingHeight");

  // WebGPUサポート状態の確認
  const [webGPUSupported, setWebGPUSupported] = useState(false);
  const [rendererType, setRendererType] = useState<RendererType>("p5js");

  useEffect(() => {
    // コンポーネントマウント時にWebGPUサポート状態を確認
    setWebGPUSupported(isWebGPUSupported() && isWebGPUInitialized());
    setRendererType(getRenderer());
  }, []);

  const zoomRateValues = ["1.2", "1.5", "2.0", "4.0", "6.0", "10", "50", "100"];
  const workerCountValues = createWorkerCountValues();
  const animationTimeValues = ["0", "1000", "600", "300", "100", "60", "33", "16", "6"];
  const animationCycleStepValues = [
    "1",
    "2",
    "3",
    "5",
    "7",
    "11",
    "13",
    "17",
    "19",
    "23",
    "29",
    "31",
    "37",
    "41",
    "43",
    "47",
  ];
  const maxCanvasSizeValues = ["-1", "128", "256", "512", "800", "1024", "2048"];
  const supersamplingWidthValues = ["1280", "1920", "2560", "3840" /* "5120", "7680" */];
  const supersamplingHeightValues = ["720", "1080", "1440", "2160" /* "2880", "4320" */];

  const [zoomRatePreview, setZoomRatePreview] = useState(zoomRate);
  const [workerCountPreview, setWorkerCountPreview] = useState(workerCount);
  const [animationTime, setAnimationTime] = useState(() => getStore("animationTime"));
  const [animationCycleStep, setAnimationCycleStep] = useState(() =>
    getStore("animationCycleStep"),
  );
  const [maxCanvasSizePreview, setMaxCanvasSizePreview] = useState(maxCanvasSize);
  const [supersamplingWidthPreview, setSupersamplingWidthPreview] = useState(supersamplingWidth);
  const [supersamplingHeightPreview, setSupersamplingHeightPreview] = useState(supersamplingHeight);

  return (
    <div className="flex max-w-80 flex-col gap-6">
      {webGPUSupported && (
        <div>
          <div className="mb-2 ml-2">Renderer Type</div>
          <RadioGroup
            value={rendererType}
            onValueChange={(value: RendererType) => {
              setRendererType(value);
              setRenderer(value);
              // レンダリングエンジン切り替え通知
              toast({
                description: (
                  <div className="flex items-center justify-center gap-2">
                    <IconCircleCheck />
                    Switched to {value === "webgpu" ? "WebGPU" : "P5.js"} renderer
                  </div>
                ),
                variant: "primary",
                duration: 3000,
              });
            }}
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="webgpu" id="webgpu" />
              <Label htmlFor="webgpu" className="cursor-pointer">
                WebGPU (Faster)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="p5js" id="p5js" />
              <Label htmlFor="p5js" className="cursor-pointer">
                P5.js (Compatible)
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      <div>
        <div className="mb-1 ml-2">Zoom Rate: x{zoomRatePreview}</div>
        <ValueSlider<number>
          values={zoomRateValues}
          defaultValue={zoomRate}
          valueConverter={(value) => parseFloat(value)}
          onValueChange={(value) => setZoomRatePreview(value)}
          onValueCommit={(value) => updateStore("zoomRate", value)}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Worker Count: {workerCountPreview}</div>
        <ValueSlider<number>
          values={workerCountValues}
          defaultValue={workerCount}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => setWorkerCountPreview(value)}
          onValueCommit={(value) => {
            updateStore("workerCount", value);
            prepareWorkerPool();
          }}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">
          Animation Frequency: {animationTime === 0 ? "None" : `${animationTime} ms`}
        </div>
        <ValueSlider<number>
          values={animationTimeValues}
          defaultValue={animationTime}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => {
            setAnimationTime(value);
          }}
          onValueCommit={(value) => {
            setAnimationTime(value);
            updateStore("animationTime", value);
          }}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Animation Cycle Step: {animationCycleStep}</div>
        <ValueSlider<number>
          values={animationCycleStepValues}
          defaultValue={animationCycleStep}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => setAnimationCycleStep(value)}
          onValueCommit={(value) => updateStore("animationCycleStep", value)}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Max Canvas Size: {maxCanvasSizePreview}</div>
        <ValueSlider<number>
          values={maxCanvasSizeValues}
          defaultValue={maxCanvasSize}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => {
            setMaxCanvasSizePreview(value);
          }}
          onValueCommit={(value) => {
            updateStore("maxCanvasSize", value);
            resizeTo();
          }}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Supersampling Width: {supersamplingWidthPreview}px</div>
        <ValueSlider<number>
          values={supersamplingWidthValues}
          defaultValue={supersamplingWidth}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => setSupersamplingWidthPreview(value)}
          onValueCommit={(value) => updateStore("supersamplingWidth", value)}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Supersampling Height: {supersamplingHeightPreview}px</div>
        <ValueSlider<number>
          values={supersamplingHeightValues}
          defaultValue={supersamplingHeight}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => setSupersamplingHeightPreview(value)}
          onValueCommit={(value) => updateStore("supersamplingHeight", value)}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Import POI List</div>
        <Button
          variant="default"
          onClick={() => {
            readPOIListFromClipboard().then((result) => {
              if (result.isErr()) {
                toast({
                  description: (
                    <div className="flex items-center justify-center gap-2">
                      <IconCircleCheck />
                      Failed to import POI List from clipboard!
                      <br />
                      {result.error}
                    </div>
                  ),
                  variant: "destructive",
                  duration: 5000,
                });
                return;
              } else {
                toast({
                  description: (
                    <div className="flex items-center justify-center gap-2">
                      <IconCircleCheck />
                      POI List imported from clipboard! <br />
                      {result.value}
                    </div>
                  ),
                  variant: "primary",
                  duration: 5000,
                });
              }
            });
          }}
        >
          Import from clipboard
        </Button>
      </div>
    </div>
  );
};

import { getStore, updateStore, useStoreValue } from "../../store/store";
import { DEFAULT_WORKER_COUNT } from "../../store/sync-storage/settings";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { readPOIListFromClipboard } from "@/store/sync-storage/poi-list";
import { useToast } from "@/components/ui/use-toast";
import { IconCircleCheck } from "@tabler/icons-react";
import { prepareWorkerPool } from "@/worker-pool/worker-pool";
import { ValueSlider } from "@/components/slider-wrapper";
import { set } from "idb-keyval";

const createWorkerCountValues = () => {
  const base = DEFAULT_WORKER_COUNT;
  const counts = [
    base / 8,
    base / 4,
    base / 2,
    base,
    base * 2,
    base * 4,
    base * 8,
  ].map(Math.ceil);
  const distinctCounts = [...new Set([1, ...counts])];
  distinctCounts.sort((a, b) => a - b);

  return distinctCounts.map((count) => count.toString());
};

export const Settings = () => {
  const { toast } = useToast();

  const zoomRate = useStoreValue<number>("zoomRate");
  const workerCount = useStoreValue<number>("workerCount");

  const zoomRateValues = ["1.2", "1.5", "2.0", "4.0", "6.0", "10", "50", "100"];
  const workerCountValues = createWorkerCountValues();
  const animationTimeValues = [
    "0",
    "6",
    "16",
    "33",
    "60",
    "100",
    "300",
    "600",
    "1000",
  ];

  const [zoomRatePreview, setZoomRatePreview] = useState(zoomRate);
  const [workerCountPreview, setWorkerCountPreview] = useState(workerCount);
  const [animationTime, setAnimationTime] = useState(() =>
    getStore("animationTime"),
  );

  return (
    <div className="flex max-w-80 flex-col gap-6">
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
          Animation Frequency:{" "}
          {animationTime === 0 ? "None" : `${animationTime} ms`}
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

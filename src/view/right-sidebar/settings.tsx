import { updateStore, useStoreValue } from "../../store/store";
import { setWorkerCount } from "../../workers";
import { DEFAULT_WORKER_COUNT } from "../../store/sync-storage/settings";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { readPOIListFromClipboard } from "@/store/sync-storage/poi-list";
import { useToast } from "@/components/ui/use-toast";
import { IconCircleCheck } from "@tabler/icons-react";

const createWorkerCountMarks = () => {
  const base = DEFAULT_WORKER_COUNT;
  const result = [{ value: 0, label: "1" }];
  const counts = [
    base / 8,
    base / 4,
    base / 2,
    base,
    base * 2,
    base * 4,
    base * 8,
  ].map(Math.ceil);
  const distinctCounts = [...new Set(counts)];
  distinctCounts.sort((a, b) => a - b);

  let i = 1;
  for (const count of distinctCounts) {
    const label = count.toString();
    result.push({ value: i, label });
    i++;
  }

  return result;
};

export const Settings = () => {
  const { toast } = useToast();

  const zoomRate = useStoreValue("zoomRate");
  const workerCount = useStoreValue("workerCount");

  const zoomRateMarks = [
    { value: 0, label: "1.2" },
    { value: 1, label: "1.5" },
    { value: 2, label: "2.0" },
    { value: 3, label: "4.0" },
    { value: 4, label: "6.0" },
    { value: 5, label: "10" },
    { value: 6, label: "50" },
    { value: 7, label: "100" },
  ];

  const workerCountMarks = createWorkerCountMarks();

  const [zoomRatePreview, setZoomRatePreview] = useState(zoomRate);

  const [workerCountPreview, setWorkerCountPreview] = useState(workerCount);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 ml-2">Zoom Rate: x{zoomRatePreview}</div>
        <Slider
          min={0}
          max={7}
          step={1}
          defaultValue={[
            zoomRateMarks.find((mark) => parseFloat(mark.label) === zoomRate)
              ?.value!,
          ]}
          onValueChange={([value]) => {
            const v = parseFloat(zoomRateMarks[value].label);
            setZoomRatePreview(v);
          }}
          onValueCommit={([value]) => {
            const v = parseFloat(zoomRateMarks[value].label);
            updateStore("zoomRate", v);
          }}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Worker Count: {workerCountPreview}</div>
        <Slider
          min={0}
          max={workerCountMarks.length - 1}
          step={1}
          defaultValue={[
            workerCountMarks.find(
              (mark) => parseInt(mark.label) === workerCount,
            )?.value!,
          ]}
          onValueChange={([value]) => {
            const v = parseInt(workerCountMarks[value].label);
            setWorkerCountPreview(v);
          }}
          onValueCommit={([value]) => {
            const v = parseInt(workerCountMarks[value].label);
            updateStore("workerCount", v);
            setWorkerCount();
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

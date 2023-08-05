import { Slider, Stack, createStyles } from "@mantine/core";
import { updateStore, useStoreValue } from "../../store/store";
import { setWorkerCount } from "../../workers";
import { DEFAULT_WORKER_COUNT } from "../../store/sync-storage/settings";

const useStyles = createStyles((theme) => ({
  afterSlider: {
    marginTop: theme.spacing.md,
  },
}));

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
  const { classes } = useStyles();
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

  return (
    <Stack>
      <div>
        Zoom Rate
        <Slider
          mt="xs"
          min={0}
          max={7}
          step={1}
          marks={zoomRateMarks}
          defaultValue={
            zoomRateMarks.find((mark) => parseFloat(mark.label) === zoomRate)
              ?.value!
          }
          label={(value) => zoomRateMarks[value].label}
          onChangeEnd={(value) => {
            const v = parseFloat(zoomRateMarks[value].label);
            updateStore("zoomRate", v);
          }}
        />
      </div>
      <div className={classes.afterSlider}>
        Worker Count
        <Slider
          mt="xs"
          min={0}
          max={workerCountMarks.length - 1}
          step={1}
          marks={workerCountMarks}
          defaultValue={
            workerCountMarks.find(
              (mark) => parseInt(mark.label) === workerCount,
            )?.value!
          }
          label={(value) => workerCountMarks[value].label}
          onChangeEnd={(value) => {
            const v = parseInt(workerCountMarks[value].label);
            updateStore("workerCount", v);
            setWorkerCount();
          }}
        />
      </div>
    </Stack>
  );
};

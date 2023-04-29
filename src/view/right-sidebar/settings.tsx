import { Slider } from "@mantine/core";
import { updateStore, useStoreValue } from "../../store/store";

export const Settings = () => {
  const zoomRate = useStoreValue("zoomRate");

  const marks = [
    { value: 0, label: "1.2" },
    { value: 1, label: "1.5" },
    { value: 2, label: "2.0" },
    { value: 3, label: "4.0" },
    { value: 4, label: "6.0" },
    { value: 5, label: "10" },
    { value: 6, label: "50" },
    { value: 7, label: "100" },
  ];

  return (
    <>
      Zoom Rate
      <Slider
        mt="xs"
        min={0}
        max={7}
        step={1}
        marks={marks}
        defaultValue={
          marks.find((mark) => parseFloat(mark.label) === zoomRate)?.value!
        }
        label={(value) => marks.find((mark) => mark.value === value)?.label}
        onChangeEnd={(value) => {
          const v = parseFloat(
            marks.find((mark) => mark.value === value)?.label!
          );
          updateStore("zoomRate", v);
        }}
      />
    </>
  );
};

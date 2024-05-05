import React from "react";
import { Slider } from "./ui/slider";

type Mark = { valueForSlider: number; value: string };

interface Props<T> {
  values: string[];
  defaultValue: T;
  valueConverter: (value: string) => T;
  onValueChange: (value: T) => void;
  onValueCommit: (value: T) => void;
}

function useMarksFromValues<T extends {}>(values: T[]): Mark[] {
  const marks = React.useMemo(() => {
    return values.map((value, index) => ({
      valueForSlider: index,
      value: value.toString(),
    }));
  }, [values]);

  return marks;
}

export function ValueSlider<T extends {}>({
  values,
  defaultValue,
  valueConverter,
  onValueChange,
  onValueCommit,
}: Props<T>) {
  const marks = useMarksFromValues(values);

  return (
    <Slider
      min={0}
      max={7}
      step={1}
      defaultValue={[
        marks.find((mark) => valueConverter(mark.value) === defaultValue)
          ?.valueForSlider!,
      ]}
      onValueChange={([value]) => {
        const v = valueConverter(marks[value].value);
        onValueChange(v);
      }}
      onValueCommit={([value]) => {
        const v = valueConverter(marks[value].value);
        onValueCommit(v);
      }}
    />
  );
}

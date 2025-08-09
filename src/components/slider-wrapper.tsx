import { Slider } from "@/shadcn/components/ui/slider";
import React from "react";

type Mark = { valueForSlider: number; value: string };

interface Props<T> {
  values: string[];
  defaultValue: T;
  valueConverter: (value: string) => T;
  onValueChange: (value: T) => void;
  onValueCommit: (value: T) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
function useMarksFromValues<T extends {}>(values: T[]): Mark[] {
  const marks = React.useMemo(() => {
    return values.map((value, index) => ({
      valueForSlider: index,
      value: value.toString(),
    }));
  }, [values]);

  return marks;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function ValueSlider<T extends {}>({
  values,
  defaultValue,
  valueConverter,
  onValueChange,
  onValueCommit,
}: Props<T>) {
  const marks = useMarksFromValues(values);
  const d = marks.find((mark) => valueConverter(mark.value) === defaultValue)?.valueForSlider;

  return (
    <Slider
      min={0}
      max={marks.length - 1}
      step={1}
      defaultValue={d ? [d] : [0]}
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

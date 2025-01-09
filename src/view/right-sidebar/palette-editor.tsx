import {
  markNeedsRerender,
  setCurrentPaletteLength,
  setCurrentPaletteOffset,
} from "@/camera/palette";
import { ValueSlider } from "@/components/slider-wrapper";
import { Slider } from "@/components/ui/slider";
import { getStore, updateStore } from "@/store/store";
import { useState } from "react";

const paletteLengthValues = [
  "4",
  "8",
  "16",
  "32",
  "48",
  "64",
  "128",
  "256",
  "512",
  "1024",
  "2048",
  "4096",
  "8192",
];

export const PaletteEditor = () => {
  const [paletteLengthValue, setPaletteLengthValue] = useState(() =>
    getStore("paletteLength"),
  );
  const [paletteOffsetValue, setPaletteOffsetValue] = useState(() =>
    getStore("paletteOffset"),
  );

  return (
    <div className="flex max-w-80 flex-col gap-6">
      <div>
        <div className="mb-1 ml-2">Palette Length: {paletteLengthValue}</div>
        <ValueSlider<number>
          values={paletteLengthValues}
          defaultValue={paletteLengthValue}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => setPaletteLengthValue(value)}
          onValueCommit={(value) => {
            updateStore("paletteLength", value);

            setCurrentPaletteOffset(0);
            setCurrentPaletteLength(value);

            setPaletteOffsetValue(0);
            updateStore("paletteOffset", 0);

            markNeedsRerender();
          }}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Palette Offset: {paletteOffsetValue}</div>
        <Slider
          min={0}
          max={paletteLengthValue * 2 - 1}
          value={[paletteOffsetValue]}
          onValueChange={([value]) => {
            setPaletteOffsetValue(value);
            updateStore("paletteOffset", value);
            setCurrentPaletteOffset(value);
            markNeedsRerender();
          }}
          onValueCommit={([value]) => {
            updateStore("paletteOffset", value);
            setCurrentPaletteOffset(value);
            markNeedsRerender();
          }}
        />
      </div>
    </div>
  );
};

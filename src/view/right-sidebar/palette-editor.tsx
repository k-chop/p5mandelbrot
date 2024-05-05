import { getPalette, redraw } from "@/camera";
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
  const [paletteLength, setPaletteLength] = useState(() =>
    getStore("paletteLength"),
  );
  const [paletteOffset, setPaletteOffset] = useState(() =>
    getStore("paletteOffset"),
  );

  return (
    <div className="flex max-w-80 flex-col gap-6">
      <div>
        <div className="mb-1 ml-2">Palette Length: {paletteLength}</div>
        <ValueSlider<number>
          values={paletteLengthValues}
          defaultValue={paletteLength}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => setPaletteLength(value)}
          onValueCommit={(value) => {
            updateStore("paletteLength", value);
            const palette = getPalette();
            palette.setLength(value);
            palette.setOffset(0);

            setPaletteOffset(0);
            updateStore("paletteOffset", 0);

            redraw();
          }}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Palette Offset: {paletteOffset}</div>
        <Slider
          min={0}
          max={paletteLength * 2 - 1}
          value={[paletteOffset]}
          onValueChange={([value]) => {
            setPaletteOffset(value);
            updateStore("paletteOffset", value);
            getPalette().setOffset(value);
            redraw();
          }}
          onValueCommit={([value]) => {
            updateStore("paletteOffset", value);
            getPalette().setOffset(value);
            redraw();
          }}
        />
      </div>
    </div>
  );
};

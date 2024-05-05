import { getPalette, redraw } from "@/camera";
import { ValueSlider } from "@/components/slider-wrapper";
import { getStore, updateStore } from "@/store/store";
import { useMemo, useState } from "react";

const paletteLengthValues = ["8", "16", "32", "48", "64", "128", "256", "512"];
// const paletteOffsetValues = ["0", "16", "32", "48", "64", "128", "256", "512"];

export const PaletteEditor = () => {
  const [paletteLength, setPaletteLength] = useState(() =>
    getStore("paletteLength"),
  );
  const [paletteOffset, setPaletteOffset] = useState(() =>
    getStore("paletteOffset"),
  );

  const paletteOffsetValues = useMemo(() => {
    return Array.from({ length: paletteLength }, (_, i) => i.toString());
  }, [paletteLength]);

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
            if (paletteOffset >= value) {
              setPaletteOffset(value - 1);
              updateStore("paletteOffset", value - 1);
            }
            const palette = getPalette();
            palette.setLength(value);
            palette.setOffset(value);
            redraw();
          }}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Palette Offset: {paletteOffset}</div>
        <ValueSlider<number>
          values={paletteOffsetValues}
          defaultValue={paletteOffset}
          valueConverter={(value) => parseInt(value)}
          onValueChange={(value) => {
            setPaletteOffset(value);
            updateStore("paletteOffset", value);
            getPalette().setOffset(value);
            redraw();
          }}
          onValueCommit={(value) => {
            updateStore("paletteOffset", value);
            getPalette().setOffset(value);
            redraw();
          }}
        />
      </div>
    </div>
  );
};

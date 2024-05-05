import { getPalette, redraw } from "@/camera";
import { ValueSlider } from "@/components/slider-wrapper";
import { getStore, updateStore } from "@/store/store";
import { useState } from "react";

const paletteLengthValues = ["8", "16", "32", "48", "64", "128", "256", "512"];

export const PaletteEditor = () => {
  const [paletteLength, setPaletteLength] = useState(getStore("paletteLength"));

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
            getPalette().setLength(value);
            redraw();
          }}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Palette Offset: 0</div>
      </div>
    </div>
  );
};

import {
  getPalettePreset,
  setCurrentPaletteLength,
  setCurrentPaletteOffset,
  setPalette,
} from "@/camera/palette";
import { ValueSlider } from "@/components/slider-wrapper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/ui/select";
import { Slider } from "@/shadcn/components/ui/slider";
import { getStore, updateStore, useStoreValue } from "@/store/store";
import { useEffect, useState } from "react";

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
  const [paletteLengthValue, setPaletteLengthValue] = useState(() => getStore("paletteLength"));
  const [paletteOffsetValue, setPaletteOffsetValue] = useState(() => getStore("paletteOffset"));

  const paletteId = useStoreValue("paletteId");

  // subscribe
  const paletteLength = useStoreValue("paletteLength");
  useEffect(() => {
    setPaletteLengthValue(paletteLength);
  }, [paletteLength]);
  const paletteOffset = useStoreValue("paletteOffset");
  useEffect(() => {
    setPaletteOffsetValue(paletteOffset);
  }, [paletteOffset]);

  const palettePresets = getPalettePreset();

  return (
    <div className="flex max-w-80 flex-col gap-6">
      <div>
        <div className="mb-1 ml-2">Palette</div>
        <Select
          value={paletteId}
          onValueChange={(e) => {
            const palette = Object.values(palettePresets).find((p) => p.id === e);
            if (!palette) return;
            setPalette(palette, { keepLength: true });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a palette" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(palettePresets).map(([key, value]) => (
              <SelectItem key={value.id} value={value.id}>
                {key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
          }}
        />
      </div>
      <div>
        <div className="mb-1 ml-2">Palette Offset: {paletteOffsetValue}</div>
        <Slider
          min={0}
          max={paletteLengthValue * 2 - 2 - 1} // mirroredの場合は2倍して先頭と末尾を引いた数になる
          value={[paletteOffsetValue]}
          onValueChange={([value]) => {
            setPaletteOffsetValue(value);
            updateStore("paletteOffset", value);
            setCurrentPaletteOffset(value);
          }}
          onValueCommit={([value]) => {
            updateStore("paletteOffset", value);
            setCurrentPaletteOffset(value);
          }}
        />
      </div>
    </div>
  );
};

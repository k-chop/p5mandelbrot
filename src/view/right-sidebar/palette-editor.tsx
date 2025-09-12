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
import { useEffect, useRef, useState } from "react";

interface PalettePreviewProps {
  paletteId: string;
  pixelLength?: number;
}

const PalettePreview = ({ paletteId, pixelLength = 256 }: PalettePreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const presets = getPalettePreset();
    const palette = Object.values(presets).find((p) => p.id === paletteId);
    if (!palette) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const length = palette.length;
    const w = el.width;
    const h = 16;
    const imageData = ctx.createImageData(w, h);

    for (let x = 0; x < w; x++) {
      const idx = Math.floor(x / (w / length));
      const [r, g, b] = palette.rgb(idx, true);
      for (let y = 0; y < h; y++) {
        const base = (y * w + x) * 4;
        imageData.data[base + 0] = r;
        imageData.data[base + 1] = g;
        imageData.data[base + 2] = b;
        imageData.data[base + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [paletteId, pixelLength]);
  return (
    <canvas
      ref={canvasRef}
      width={256}
      height={16}
      className="h-4 w-full rounded border border-muted/40"
      aria-hidden
    />
  );
};

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
          <SelectTrigger className="flex items-center gap-2">
            <SelectValue placeholder="Select a palette" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(palettePresets).map(([key, value]) => (
              <SelectItem key={value.id} value={value.id}>
                <div className="flex flex-col items-start w-full">
                  <span>{key}</span>
                  <PalettePreview paletteId={value.id} />
                </div>
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

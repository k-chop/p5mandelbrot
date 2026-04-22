import { useT } from "@/i18n/context";
import { setCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { Button } from "@/shadcn/components/ui/button";
import { Input } from "@/shadcn/components/ui/input";
import { Label } from "@/shadcn/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/ui/select";
import { updateStore, useStoreValue } from "@/store/store";
import { Expand } from "lucide-react";
import { useState } from "react";

const MIN_SIZE = 100;
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;

/** サイズをmin/max範囲にclampする */
const clampSize = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

type Preset = {
  label: string;
  width: number;
  height: number;
};

const PRESETS: Preset[] = [
  { label: "HD (1280x720)", width: 1280, height: 720 },
  { label: "Full HD (1920x1080)", width: 1920, height: 1080 },
  { label: "QHD (2560x1440)", width: 2560, height: 1440 },
  { label: "4K (3840x2160)", width: 3840, height: 2160 },
  { label: "5K (5120x2880)", width: 5120, height: 2880 },
  { label: "8K (7680x4320)", width: 7680, height: 4320 },
];

/**
 * Display Size プリセット用の物理px解像度を返す
 *
 * 論理px (window.screen.width/height) にdevicePixelRatioを掛けて物理解像度化する。
 * モバイル (例: Pixel 6a 論理412×915, dpr=2.625) で真の実機解像度 (~1081×2403) を
 * supersamplingに指定するために使う。
 */
const getPhysicalDisplaySize = (): { width: number; height: number } => ({
  width: Math.round(window.screen.width * window.devicePixelRatio),
  height: Math.round(window.screen.height * window.devicePixelRatio),
});

/** 現在の幅・高さに一致するプリセットキーを返す。なければ "custom" */
const findPresetKey = (width: number, height: number): string => {
  const match = PRESETS.find((p) => p.width === width && p.height === height);
  if (match) return match.label;

  const physical = getPhysicalDisplaySize();
  if (width === physical.width && height === physical.height) {
    return "display";
  }

  return "custom";
};

/**
 * スーパーサンプリング設定フォーム
 *
 * PopoverContent や DialogContent の中に直接配置して使う。
 */
export const SupersamplingForm = () => {
  const t = useT();
  const storedWidth = useStoreValue("supersamplingWidth");
  const storedHeight = useStoreValue("supersamplingHeight");

  const [width, setWidth] = useState(storedWidth);
  const [height, setHeight] = useState(storedHeight);
  const [presetKey, setPresetKey] = useState(() => findPresetKey(storedWidth, storedHeight));

  /** プリセット選択時のハンドラ */
  const handlePresetChange = (key: string) => {
    setPresetKey(key);

    if (key === "display") {
      const physical = getPhysicalDisplaySize();
      const w = clampSize(physical.width, MIN_SIZE, MAX_WIDTH);
      const h = clampSize(physical.height, MIN_SIZE, MAX_HEIGHT);
      setWidth(w);
      setHeight(h);
      updateStore("supersamplingWidth", w);
      updateStore("supersamplingHeight", h);
      return;
    }

    if (key === "custom") return;

    const preset = PRESETS.find((p) => p.label === key);
    if (preset) {
      setWidth(preset.width);
      setHeight(preset.height);
      updateStore("supersamplingWidth", preset.width);
      updateStore("supersamplingHeight", preset.height);
    }
  };

  /** 幅の入力確定 */
  const commitWidth = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = clampSize(parsed, MIN_SIZE, MAX_WIDTH);
    setWidth(clamped);
    updateStore("supersamplingWidth", clamped);
    setPresetKey(findPresetKey(clamped, height));
  };

  /** 高さの入力確定 */
  const commitHeight = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = clampSize(parsed, MIN_SIZE, MAX_HEIGHT);
    setHeight(clamped);
    updateStore("supersamplingHeight", clamped);
    setPresetKey(findPresetKey(width, clamped));
  };

  /** スーパーサンプリング実行 */
  const handleGenerate = () => {
    setCurrentParams({ isSuperSampling: true });
  };

  const physicalDisplay = getPhysicalDisplaySize();
  const displaySizeLabel = `${t("Display Size", "settings.displaySize")} (${physicalDisplay.width}x${physicalDisplay.height})`;

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs text-muted-foreground">
        {t("Output Size", "settings.outputSize")}
      </Label>

      <Select value={presetKey} onValueChange={handlePresetChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="display">{displaySizeLabel}</SelectItem>
          {PRESETS.map((p) => (
            <SelectItem key={p.label} value={p.label}>
              {p.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">{t("Custom", "settings.custom")}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={width}
          onChange={(e) => setWidth(Number.parseInt(e.target.value, 10) || MIN_SIZE)}
          onBlur={(e) => commitWidth(e.target.value)}
          className="h-8 font-mono text-xs"
        />
        <span className="text-xs text-muted-foreground">x</span>
        <Input
          inputMode="numeric"
          value={height}
          onChange={(e) => setHeight(Number.parseInt(e.target.value, 10) || MIN_SIZE)}
          onBlur={(e) => commitHeight(e.target.value)}
          className="h-8 font-mono text-xs"
        />
      </div>

      <Button size="sm" onClick={handleGenerate}>
        <Expand className="mr-1 size-4" />
        {t("Generate", "settings.generate")}
      </Button>
    </div>
  );
};

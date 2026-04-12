import { forceReRender, getCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import {
  calcRequiredLimbs,
  clampLimbs,
  MAX_LIMBS,
  totalBitsFromLimbs,
} from "@/math/calc-required-limbs";
import { calcCoordPrecision } from "@/math/coord-precision";
import { Slider } from "@/shadcn/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shadcn/components/ui/tabs";
import { updateStore, useStoreValue } from "@/store/store";
import { useEffect, useMemo, useState } from "react";
import { BatchRenderViewer } from "./batch-render-viewer";
import { EventViewer } from "./event-viewer";
import { InterestingPointsViewer } from "./interesting-points-viewer";

/** Slider 左端の「auto」位置を表す値。実際の limb override では 2 以上を使う。 */
const SLIDER_AUTO_VALUE = 1;

export const DebugMode = () => {
  const debugModeTab = useStoreValue("debugModeTab");

  return (
    <Tabs value={debugModeTab} onValueChange={(v) => updateStore("debugModeTab", v)}>
      <LimbStatusPanel />
      <TabsList>
        <TabsTrigger value="batch-render">Batch Render</TabsTrigger>
        <TabsTrigger value="event-viewer">Event Viewer</TabsTrigger>
        <TabsTrigger value="ip-debug">Interesting Points</TabsTrigger>
      </TabsList>
      <TabsContent value="batch-render">
        <BatchRenderViewer />
      </TabsContent>
      <TabsContent value="event-viewer">
        <EventViewer />
      </TabsContent>
      <TabsContent value="ip-debug">
        <InterestingPointsViewer />
      </TabsContent>
    </Tabs>
  );
};

/**
 * 現在表示中の地点を計算するのに使われる limb 数を表示し、手動上書きを受け付ける UI。
 * reference orbit の精度が疑わしいときに「精度不足なのか他要因か」を切り分ける用途。
 *
 * スライダーは [1..32]。値 1 (一番左) は auto、2..32 は override 値を直接表す。
 */
const LimbStatusPanel = () => {
  // center 座標・半径・反復回数の変化をトリガーにする
  const centerX = useStoreValue("centerX");
  const centerY = useStoreValue("centerY");
  const r = useStoreValue("r");
  const N = useStoreValue("N");
  const manualLimbsOverride = useStoreValue("manualLimbsOverride");

  // 現在のパラメータで自動計算された limb 数
  const autoLimbs = useMemo(() => {
    // worker-facade と同じ手順で wasm に渡す座標文字列を作る
    const params = getCurrentParams();
    const precision = calcCoordPrecision(r);
    const xStr = params.x.toPrecision(precision);
    const yStr = params.y.toPrecision(precision);
    return calcRequiredLimbs(xStr, yStr, N);
    // centerX/centerY は useStoreValue 購読用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerX, centerY, r, N]);

  // スライダーの現在値（ドラッグ中の表示反映用ローカル state）
  const [sliderValue, setSliderValue] = useState<number>(manualLimbsOverride ?? SLIDER_AUTO_VALUE);

  useEffect(() => {
    setSliderValue(manualLimbsOverride ?? SLIDER_AUTO_VALUE);
  }, [manualLimbsOverride]);

  const isAuto = sliderValue === SLIDER_AUTO_VALUE;
  const displayLimbs = isAuto ? autoLimbs : clampLimbs(sliderValue);
  const displayBits = totalBitsFromLimbs(displayLimbs);

  const commit = (value: number) => {
    if (value === SLIDER_AUTO_VALUE) {
      updateStore("manualLimbsOverride", null);
    } else {
      updateStore("manualLimbsOverride", clampLimbs(value));
    }
    forceReRender();
  };

  return (
    <div className="mb-2 rounded border border-[#2a2a3a] bg-[#0f0f18] p-2 text-xs">
      <div className="mb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Reference orbit limbs</span>
          <span className="font-mono">
            {displayLimbs} limbs
            <span className="text-muted-foreground"> ({displayBits} bit)</span>
            {isAuto ? (
              <span className="text-muted-foreground"> auto</span>
            ) : (
              <span className="text-yellow-400"> override</span>
            )}
          </span>
        </div>
        {!isAuto && (
          <div className="text-muted-foreground mt-0.5 text-right font-mono">
            auto: {autoLimbs} limbs ({totalBitsFromLimbs(autoLimbs)} bit)
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground shrink-0 font-mono">auto</span>
        <Slider
          min={SLIDER_AUTO_VALUE}
          max={MAX_LIMBS}
          step={1}
          value={[sliderValue]}
          onValueChange={([v]) => setSliderValue(v)}
          onValueCommit={([v]) => commit(v)}
        />
        <span className="text-muted-foreground shrink-0 font-mono">{MAX_LIMBS}</span>
      </div>
    </div>
  );
};

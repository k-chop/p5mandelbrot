import { SimpleTooltip } from "../../../components/simple-tooltip";
import { useT } from "../../../i18n/context";
import type { BlockDebugInfo } from "../../../interesting-points/find-interesting-points";
import { Label } from "../../../shadcn/components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../shadcn/components/ui/radio-group";
import { Switch } from "../../../shadcn/components/ui/switch";
import { updateStoreWith, useStoreValue } from "../../../store/store";
import { useState } from "react";
import { BlockHeatmap } from "./block-heatmap";
import { PointDetailPanel } from "./point-detail-panel";

/**
 * 興味深いポイント検出のデバッグ情報を表示するメインコンポーネント
 *
 * ヒートマップ、factor選択、ポイント詳細パネルを統合する。
 */
export const InterestingPointsViewer = () => {
  const t = useT();
  const debugData = useStoreValue("interestingPointsDebugData");
  const alwaysDebug = useStoreValue("alwaysComputeIPDebugData");
  const [selectedFactor, setSelectedFactor] = useState("score");
  const [selectedBlock, setSelectedBlock] = useState<BlockDebugInfo | null>(null);

  // factor 名は全ブロック共通なので先頭ブロックから取る
  const blocks = debugData?.gridBlocks ?? [];
  const factorNames = ["score", ...Object.keys(blocks[0]?.factors ?? {})];

  const alwaysDebugToggle = (
    <SimpleTooltip
      side="bottom"
      content={
        <>
          {t("Computes debug data even when this tab is closed.")}
          <br />
          {t("May slow down rendering.")}
        </>
      }
    >
      <div className="flex w-fit items-center space-x-2">
        <Switch
          id="always-compute-ip-debug"
          checked={alwaysDebug}
          onCheckedChange={() => updateStoreWith("alwaysComputeIPDebugData", (v) => !v)}
        />
        <Label htmlFor="always-compute-ip-debug">{t("Always compute debug data")}</Label>
      </div>
    </SimpleTooltip>
  );

  if (!debugData) {
    return (
      <div className="space-y-2 p-2">
        {alwaysDebugToggle}
        <div className="text-muted-foreground text-sm italic">
          デバッグデータを有効にして盤面を描画すると、ここに表示されます
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-2">
      {alwaysDebugToggle}
      <div className="text-sm font-medium">Points: {debugData.selectedPoints.length}</div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Factor:</span>
          <RadioGroup
            value={selectedFactor}
            onValueChange={setSelectedFactor}
            className="flex flex-wrap gap-2"
          >
            {factorNames.map((name) => (
              <div key={name} className="flex items-center gap-1">
                <RadioGroupItem value={name} id={`factor-${name}`} className="h-3 w-3" />
                <Label htmlFor={`factor-${name}`} className="text-xs cursor-pointer">
                  {name}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>

      <BlockHeatmap
        blocks={blocks}
        selectedPoints={debugData.selectedPoints}
        selectedFactor={selectedFactor}
        onBlockClick={setSelectedBlock}
      />

      <div className="space-y-2">
        <PointDetailPanel block={selectedBlock} selectedPoints={debugData.selectedPoints} />
      </div>
    </div>
  );
};

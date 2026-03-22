import { SimpleTooltip } from "@/components/simple-tooltip";
import { useT } from "@/i18n/context";
import { exportEvalData } from "@/interesting-points/export-eval-data";
import type { BlockDebugInfo } from "@/interesting-points/find-interesting-points";
import { requestCanvasImage } from "@/p5-adapter/p5-adapter";
import { getCanvasSize } from "@/rendering/renderer";
import { Button } from "@/shadcn/components/ui/button";
import { Label } from "@/shadcn/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shadcn/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/ui/select";
import { Switch } from "@/shadcn/components/ui/switch";
import { toast } from "@/shadcn/hooks/use-toast";
import { updateStoreWith, useStoreValue } from "@/store/store";
import { useMemo, useState } from "react";
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
  const [selectedScale, setSelectedScale] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  // 表示対象のブロック一覧を取得
  const blocks = useMemo(() => {
    if (!debugData) return [];

    if (debugData.scoring === "symmetry") {
      return debugData.gridBlocks;
    }

    if (selectedScale === "all") {
      return debugData.scaleBlocks.flatMap((sb) => sb.blocks);
    }

    const scaleNum = Number(selectedScale);
    return debugData.scaleBlocks.find((sb) => sb.scale === scaleNum)?.blocks ?? [];
  }, [debugData, selectedScale]);

  // 利用可能なfactor名一覧を動的に取得
  const factorNames = useMemo(() => {
    const names = new Set<string>();
    names.add("score");
    for (const block of blocks) {
      for (const key of Object.keys(block.factors)) {
        names.add(key);
      }
    }
    return [...names];
  }, [blocks]);

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
      <div className="text-sm font-medium">
        Scoring: {debugData.scoring} | Points: {debugData.selectedPoints.length}
        {debugData.centerPoint && " | Center: ◆"}
      </div>

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

        {debugData.scoring === "entropy-gradient" && debugData.scaleBlocks.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Scale:</span>
            <Select value={selectedScale} onValueChange={setSelectedScale}>
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {debugData.scaleBlocks.map((sb) => (
                  <SelectItem key={sb.scale} value={String(sb.scale)}>
                    {sb.scale}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <BlockHeatmap
        blocks={blocks}
        selectedPoints={debugData.selectedPoints}
        centerPoint={debugData.centerPoint}
        selectedFactor={selectedFactor}
        onBlockClick={setSelectedBlock}
      />

      <div className="space-y-2">
        <PointDetailPanel block={selectedBlock} selectedPoints={debugData.selectedPoints} />

        <div className="space-y-1">
          <div className="text-xs font-medium">
            Candidates: {debugData.rawCandidates.length} raw → {debugData.mergedCandidates.length}{" "}
            merged → {debugData.selectedPoints.length} selected
          </div>
          {debugData.centerPoint && (
            <div className="text-xs text-yellow-400">
              ◆ Center: ({debugData.centerPoint.x}, {debugData.centerPoint.y}) score=
              {debugData.centerPoint.score.toFixed(6)}
            </div>
          )}
        </div>

        {location.hostname === "localhost" && (
          <SimpleTooltip
            side="bottom"
            content={
              <>
                {t("Exports data for agent evaluation to ./tmp/eval/.")}
                <br />
                {t("Only available when running locally with dev-all.")}
              </>
            }
          >
            <Button
              variant="outline"
              size="sm"
              disabled={isExporting}
              onClick={async () => {
                setIsExporting(true);
                try {
                  const pointIndex = await exportEvalData(
                    () =>
                      new Promise<string>((resolve) => {
                        const { width } = getCanvasSize();
                        requestCanvasImage(width, resolve);
                      }),
                  );
                  toast({
                    title: "Export complete",
                    description: `Saved to tmp/eval/point-${pointIndex}/`,
                  });
                } catch (e) {
                  toast({
                    title: "Export failed",
                    description: e instanceof Error ? e.message : "Unknown error",
                    variant: "destructive",
                  });
                } finally {
                  setIsExporting(false);
                }
              }}
            >
              {isExporting ? "Exporting..." : "Export for Eval"}
            </Button>
          </SimpleTooltip>
        )}
      </div>
    </div>
  );
};

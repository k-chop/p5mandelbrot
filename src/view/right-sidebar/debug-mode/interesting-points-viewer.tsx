import type { BlockDebugInfo } from "@/interesting-points/find-interesting-points";
import { Label } from "@/shadcn/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shadcn/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/ui/select";
import { useStoreValue } from "@/store/store";
import { useMemo, useState } from "react";
import { BlockHeatmap } from "./block-heatmap";
import { PointDetailPanel } from "./point-detail-panel";

/**
 * 興味深いポイント検出のデバッグ情報を表示するメインコンポーネント
 *
 * ヒートマップ、factor選択、ポイント詳細パネルを統合する。
 */
export const InterestingPointsViewer = () => {
  const debugData = useStoreValue("interestingPointsDebugData");
  const [selectedFactor, setSelectedFactor] = useState("score");
  const [selectedBlock, setSelectedBlock] = useState<BlockDebugInfo | null>(null);
  const [selectedScale, setSelectedScale] = useState<string>("all");

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

  if (!debugData) {
    return (
      <div className="space-y-2 p-2">
        <div className="text-muted-foreground text-sm italic">
          Interesting Points を有効にして盤面を描画すると、デバッグデータが表示されます
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-2">
      <div className="text-sm font-medium">
        Scoring: {debugData.scoring} | Points: {debugData.selectedPoints.length}
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
        </div>
      </div>
    </div>
  );
};

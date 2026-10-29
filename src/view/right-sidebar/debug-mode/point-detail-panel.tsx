import { useT } from "../../../i18n/context";
import type {
  BlockDebugInfo,
  InterestingPoint,
} from "../../../interesting-points/find-interesting-points";

/**
 * 選択されたブロック/ポイントの詳細情報を表示するパネル
 *
 * 全factorの値、最終スコア、ランク情報を一覧表示する。
 */
export const PointDetailPanel = ({
  block,
  selectedPoints,
}: {
  block: BlockDebugInfo | null;
  selectedPoints: InterestingPoint[];
}) => {
  const t = useT();

  if (!block) {
    return (
      <div className="text-muted-foreground text-xs italic">
        {t("Click a block to show details")}
      </div>
    );
  }

  // このブロック内に選出ポイントがあればその順位
  const rank =
    selectedPoints.findIndex(
      (p) =>
        p.x >= block.bx &&
        p.x < block.bx + block.blockSize &&
        p.y >= block.by &&
        p.y < block.by + block.blockSize,
    ) + 1;

  return (
    <div className="space-y-1 rounded border p-2 text-xs">
      <div className="font-medium">Block Detail</div>
      <div>
        Position: ({block.bx}, {block.by}) size={block.blockSize}
      </div>
      <div className="font-medium">Score: {block.score.toFixed(6)}</div>
      <div className="mt-1 font-medium">Factors:</div>
      {Object.entries(block.factors).map(([key, value]) => (
        <div key={key} className="pl-2">
          {key}: {value.toFixed(6)}
        </div>
      ))}
      {rank > 0 && (
        <div className="mt-1 font-medium text-amber-400">
          Rank: #{rank} / {selectedPoints.length}
        </div>
      )}
    </div>
  );
};

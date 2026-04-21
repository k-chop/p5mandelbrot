import { useStoreValue } from "@/store/store";
import { useIsMobile } from "@/view/use-is-mobile";
import { Footer } from "../footer";

/**
 * progress文字列から進捗率 (0〜100) を抽出する
 *
 * - "Generating... 47%" → 47
 * - "Calculate reference orbit... 42 / 1000" → 4.2
 */
const parseProgressPercent = (s: string): number => {
  const percentMatch = s.match(/(\d+)%/);
  if (percentMatch) return Number.parseInt(percentMatch[1], 10);

  const fractionMatch = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const num = Number.parseInt(fractionMatch[1], 10);
    const den = Number.parseInt(fractionMatch[2], 10);
    return den > 0 ? (num / den) * 100 : 0;
  }

  return 0;
};

/**
 * モバイル用の細ラインプログレスバー + 完了時footer
 *
 * - 描画中: 画面下端3pxの細いプログレスラインのみ
 * - 完了後: 12px高の薄背景footerにelapsed表示 + 下端3pxにフルバー
 */
const MobileProgressBar = () => {
  const progress = useStoreValue("progress");

  const isDone = typeof progress === "object" && progress !== null;
  const percent = isDone ? 100 : typeof progress === "string" ? parseProgressPercent(progress) : 0;
  const elapsedText = isDone ? `${progress.total}ms` : "";

  return (
    <div className="pointer-events-none fixed right-0 bottom-0 left-0 z-50 h-3">
      {isDone && (
        <div className="absolute inset-x-0 top-0 bottom-[3px] flex items-center justify-end bg-[#1c1c24]/70 px-2 backdrop-blur-sm">
          <span className="text-[9px] leading-none text-muted-foreground">{elapsedText}</span>
        </div>
      )}
      <div className="absolute right-0 bottom-0 left-0 h-[3px] bg-gray-700/30">
        <div
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

/** デスクトップ用の詳細プログレスバー (従来の左下w-125固定) */
const DesktopProgressBar = () => (
  <div className="fixed bottom-3 left-3 z-100 w-125 rounded-xl border border-[#2a2a3a] bg-[#1c1c24]/95 px-3 py-2 backdrop-blur-sm">
    <Footer />
  </div>
);

/** フローティング進捗バー (モバイル時は細ライン+footerに切替) */
export const ProgressBar = () => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileProgressBar /> : <DesktopProgressBar />;
};

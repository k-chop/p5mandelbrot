import { updateStore, useStoreValue } from "@/store/store";
import { IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import { DebugMode } from "../right-sidebar/debug-mode/debug-mode";
import { useIsWideViewport } from "./use-is-wide-viewport";

/** 狭い画面での排他ロジック: デバッグON時にPOIパネルを閉じる */
const useExclusivePanels = () => {
  const isDebugMode = useStoreValue("isDebugMode");
  const isNarrow = !useIsWideViewport(1440);

  useEffect(() => {
    if (isNarrow && isDebugMode) {
      updateStore("poiPanelOpen", false);
    }
  }, [isNarrow, isDebugMode]);
};

/**
 * ビューポート幅に応じたデバッグパネル幅を返す
 *
 * 段階的な固定幅で、連続リサイズ時のレイアウト再計算を避ける。
 * 2200px以上: 636px、1800px以上: 500px、それ以下: 436px
 */
const useDebugPanelWidth = () => {
  const isUltraWide = useIsWideViewport(2200);
  const isWide = useIsWideViewport(1800);

  if (isUltraWide) return "w-[636px]";
  if (isWide) return "w-[500px]";
  return "w-[436px]";
};

/** 左側スライドインデバッグパネル */
export const DebugPanel = () => {
  const isDebugMode = useStoreValue("isDebugMode");

  useExclusivePanels();

  const width = useDebugPanelWidth();

  return (
    <div
      className={`fixed top-16 left-0 z-[90] flex h-[calc(100%-4rem)] flex-col border-r border-[#2a2a3a] transition-transform duration-300 ${width} ${
        isDebugMode
          ? "translate-x-0 bg-[#161620]/97 shadow-[4px_0_16px_rgba(0,0,0,0.5)] backdrop-blur-sm"
          : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#2a2a3a] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">DEBUG</span>
        </div>
        <button
          onClick={() => updateStore("isDebugMode", false)}
          className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
        >
          <IconX size={18} />
        </button>
      </div>
      <div className="flex min-h-0 grow flex-col overflow-y-auto px-2 pt-2">
        {isDebugMode && <DebugMode />}
      </div>
    </div>
  );
};

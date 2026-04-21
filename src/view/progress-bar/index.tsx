import { Footer } from "../footer";

/**
 * フローティング進捗バー
 *
 * デスクトップ: 左下に500px固定幅で配置。
 * モバイル (<=768px): 画面下端いっぱいに配置し、POI BottomSheetのピーク(15vh)の上にずらす。
 */
export const ProgressBar = () => {
  return (
    <div className="fixed right-3 bottom-[calc(15vh+0.75rem)] left-3 z-100 rounded-xl border border-[#2a2a3a] bg-[#1c1c24]/95 px-3 py-2 backdrop-blur-sm md:right-auto md:bottom-3 md:w-125">
      <Footer />
    </div>
  );
};

import { createContext, useContext } from "react";

/**
 * POIリスト(右サイドバー内の縦スクロールグリッド)のスクロール位置を
 * パネル開閉/モバイル切り替えをまたいで保持するためのContext。
 *
 * 値は数値のRef。値の更新時に再レンダーを走らせないため、ref オブジェクト
 * 自体は親で安定保持し、`current` を直接読み書きする。
 */
const POIScrollContext = createContext<React.RefObject<number> | null>(null);

export const POIScrollProvider = POIScrollContext.Provider;

/**
 * POIリストのスクロール位置refを取得する。
 * Providerの外で呼ばれた場合はnullを返す。
 */
export const usePOIScrollRef = (): React.RefObject<number> | null => useContext(POIScrollContext);

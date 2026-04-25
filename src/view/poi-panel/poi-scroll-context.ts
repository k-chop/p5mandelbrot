import { createContext, useCallback, useContext, useRef } from "react";

/**
 * POIパネル内で複数あるスクロール領域それぞれの位置を保持するためのRef群。
 *
 * Refオブジェクトは初回作成後不変なので、Provider value全体も一度生成すれば
 * 配下の再レンダーは走らない。各位置の `current` は直接読み書きする。
 */
export type POIScrollRefs = {
  /** POI一覧グリッド (縦スクロール) */
  main: React.RefObject<number>;
  /** デスクトップ閉時のCollapsedStrip (縦スクロール) */
  collapsedStrip: React.RefObject<number>;
  /** モバイルsmall状態の横スクロールストリップ */
  mobileSmall: React.RefObject<number>;
};

export type POIScrollKey = keyof POIScrollRefs;

const POIScrollContext = createContext<POIScrollRefs | null>(null);

export const POIScrollProvider = POIScrollContext.Provider;

/**
 * 指定したkeyのスクロール位置refを取得する。
 * Provider外で呼ばれた場合はnullを返す。
 */
export const usePOIScrollRef = (key: POIScrollKey): React.RefObject<number> | null =>
  useContext(POIScrollContext)?.[key] ?? null;

/**
 * スクロール容器に当てるref callbackとonScrollハンドラを生成するhook。
 *
 * - ref attach時に保存済み位置を復元
 * - onScroll は requestAnimationFrame で trailing throttle して負荷を抑える
 *
 * `axis` で縦/横スクロールを切り替える (デフォルト: vertical)。
 */
export const useScrollSaver = (
  ref: React.RefObject<number> | null,
  axis: "vertical" | "horizontal" = "vertical",
) => {
  const rafIdRef = useRef<number | null>(null);

  const setScrollContainer = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !ref) return;
      if (axis === "horizontal") {
        node.scrollLeft = ref.current;
      } else {
        node.scrollTop = ref.current;
      }
    },
    [ref, axis],
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!ref) return;
      const value = axis === "horizontal" ? e.currentTarget.scrollLeft : e.currentTarget.scrollTop;
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        ref.current = value;
        rafIdRef.current = null;
      });
    },
    [ref, axis],
  );

  return { setScrollContainer, handleScroll };
};

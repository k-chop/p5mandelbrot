import { useEffect, useState } from "react";

/**
 * ビューポート幅が指定px以上かどうかを返すフック
 *
 * @param minWidth - 最小幅 (px)
 * @returns ビューポート幅 >= minWidth なら true
 */
export const useIsWideViewport = (minWidth: number): boolean => {
  const [isWide, setIsWide] = useState(() => window.innerWidth >= minWidth);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${minWidth}px)`);
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);

    setIsWide(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [minWidth]);

  return isWide;
};

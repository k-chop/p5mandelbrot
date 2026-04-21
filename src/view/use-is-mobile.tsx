import { useEffect, useState } from "react";

/** モバイル扱いとするビューポートの最大幅 (px) */
export const MOBILE_MAX_WIDTH = 768;

/**
 * ビューポート幅がモバイル扱い (<= {@link MOBILE_MAX_WIDTH}px) かどうかを返すフック
 *
 * @returns モバイル扱いなら true
 */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_MAX_WIDTH);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
};

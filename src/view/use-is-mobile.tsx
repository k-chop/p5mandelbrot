import { useEffect, useState } from "react";

/** モバイル扱いとするビューポートの最大幅 (px) */
export const MOBILE_MAX_WIDTH = 768;

/**
 * 現在のビューポートがモバイル幅かどうかを同期的に返す
 *
 * Reactコンテキスト外 (p5 draw ループ等) から使うための関数版。
 * UI から使う場合は {@link useIsMobile} を使うこと。
 */
export const isMobileViewport = (): boolean =>
  window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;

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

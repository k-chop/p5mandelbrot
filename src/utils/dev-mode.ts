/**
 * dev-all起動時のみtrueを返す
 *
 * VITE_P5_MANDELBROT_DEVELOPMENT環境変数で判定する。
 */
export const isDevMode = (): boolean => import.meta.env.VITE_P5_MANDELBROT_DEVELOPMENT === "true";

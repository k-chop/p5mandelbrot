import type p5 from "p5";

/** 現在のマウスカーソルがcanvas内に入っているかどうか */
export const isInside = (p: p5) =>
  0 <= p.mouseX && p.mouseX <= p.width && 0 <= p.mouseY && p.mouseY <= p.height;

// mouseDragged等で高頻度呼び出しされるため、DOM要素をキャッシュ
let cachedP5Root: HTMLElement | null = null;
let cachedCanvasOverlay: HTMLElement | null = null;

/**
 * イベントの対象がフローティングUI要素上かどうか判定する
 *
 * ツールバーやパネル等のUI要素上でのクリックがキャンバスに伝播するのを防ぐ。
 */
export const isOnUIOverlay = (ev: MouseEvent): boolean => {
  const target = ev.target as HTMLElement | null;
  if (!target) return false;

  cachedP5Root ??= document.getElementById("p5root");
  cachedCanvasOverlay ??= document.getElementById("canvas-overlay");

  if (cachedP5Root?.contains(target)) return false;
  if (cachedCanvasOverlay?.contains(target)) return false;

  return true;
};

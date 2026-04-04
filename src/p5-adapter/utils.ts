import type p5 from "p5";

/** 現在のマウスカーソルがcanvas内に入っているかどうか */
export const isInside = (p: p5) =>
  0 <= p.mouseX && p.mouseX <= p.width && 0 <= p.mouseY && p.mouseY <= p.height;

/**
 * イベントの対象がフローティングUI要素上かどうか判定する
 *
 * ツールバーやパネル等のUI要素上でのクリックがキャンバスに伝播するのを防ぐ。
 */
export const isOnUIOverlay = (ev: MouseEvent): boolean => {
  const target = ev.target as HTMLElement | null;
  if (!target) return false;

  // p5rootの子要素（canvas自体）なら false
  const p5root = document.getElementById("p5root");
  if (p5root?.contains(target)) return false;

  // canvas-overlay の子要素も false
  const canvasOverlay = document.getElementById("canvas-overlay");
  if (canvasOverlay?.contains(target)) return false;

  // それ以外（ツールバー、パネル等）は true
  return true;
};

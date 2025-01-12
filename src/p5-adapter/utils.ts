import type p5 from "p5";

/** 現在のマウスカーソルがcanvas内に入っているかどうか */
export const isInside = (p: p5) =>
  0 <= p.mouseX && p.mouseX <= p.width && 0 <= p.mouseY && p.mouseY <= p.height;

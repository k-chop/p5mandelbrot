import type * as p5Type from "p5";

// p5.Imageはcanvas持っているのに型定義には存在しない
type Image = p5Type.Image & { canvas: HTMLCanvasElement };

let p5: p5Type;

export const setP5 = (p5Instance: p5Type) => {
  p5 = p5Instance;
};

/*
 * canvasの画像をリサイズした後にDataURLを返す
 * 0を指定すると元のサイズで保存する
 */
export const getResizedCanvasImageDataURL = (height: number = 0) => {
  const img = p5.get() as Image;
  // 0にしておくと指定した方の高さに合わせてリサイズしてくれる
  img.resize(0, height);

  return img.canvas.toDataURL();
};

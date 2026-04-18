import type { Complex } from "@/math/complex";

/**
 * [re0, im0, re1, im1, ...] レイアウトのFloat64ArrayをSharedArrayBufferに丸ごとコピーする
 */
export function encodeFloat64AsXnBuffer(source: Float64Array): SharedArrayBuffer {
  const buffer = new SharedArrayBuffer(source.byteLength);
  new Float64Array(buffer).set(source);
  return buffer;
}

/**
 * refOrbit(xn)をArrayBufferのまま扱い直接値取得できるようにしたラッパー
 */
export class ComplexArrayView {
  /** hot pathからの直接アクセス用にpublic。通常はget系メソッドを使うこと。 */
  readonly view: Float64Array;

  constructor(buffer: SharedArrayBuffer) {
    this.view = new Float64Array(buffer);
  }

  /**
   * refOrbitの長さを取得
   */
  get length(): number {
    return this.view.length / 2;
  }

  /**
   * インデックスで指定した複素数の実部を取得
   */
  getRe(index: number): number {
    return this.view[index * 2];
  }

  /**
   * インデックスで指定した複素数の虚部を取得
   */
  getIm(index: number): number {
    return this.view[index * 2 + 1];
  }

  /**
   * インデックスで指定した複素数を取得
   */
  get(index: number): Complex {
    return {
      re: this.view[index * 2],
      im: this.view[index * 2 + 1],
    };
  }

  toArray(limit?: number): Complex[] {
    const length = limit ? Math.min(limit, this.length) : this.length;
    const result = Array.from<Complex>({ length });

    for (let i = 0; i < length; i++) {
      result[i] = this.get(i);
    }

    return result;
  }
}

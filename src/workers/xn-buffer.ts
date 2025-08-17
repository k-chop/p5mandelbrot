import type { Complex } from "@/math/complex";

const COMPLEX_BYTE_LENGTH = 16;

// このファイルはほとんどChatGPTくんによって生成されました

export function encodeComplexArray(complexArray: Complex[]): SharedArrayBuffer {
  const buffer = new SharedArrayBuffer(complexArray.length * COMPLEX_BYTE_LENGTH);
  const view = new Float64Array(buffer);

  complexArray.forEach((complex, index) => {
    view[index * 2] = complex.re;
    view[index * 2 + 1] = complex.im;
  });

  return buffer;
}

/**
 * refOrbit(xn)をArrayBufferのまま扱い直接値取得できるようにしたラッパー
 */
export class ComplexArrayView {
  private view: Float64Array;

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
    const result = new Array(length);

    for (let i = 0; i < length; i++) {
      result[i] = this.get(i);
    }

    return result;
  }
}

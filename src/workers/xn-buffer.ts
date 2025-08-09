import type { Complex } from "@/math/complex";

const COMPLEX_BYTE_LENGTH = 16;

// このファイルはほとんどChatGPTくんによって生成されました

export function encodeComplexArray(complexArray: Complex[]): ArrayBuffer {
  const buffer = new ArrayBuffer(complexArray.length * COMPLEX_BYTE_LENGTH);
  const view = new Float64Array(buffer);

  complexArray.forEach((complex, index) => {
    view[index * 2] = complex.re;
    view[index * 2 + 1] = complex.im;
  });

  return buffer;
}

/**
 * ArrayBufferから複素数配列へのデコードを行う
 * メモリ効率改善版: 巨大なバッファをデコードする場合は注意
 * @param buffer 複素数データを含むArrayBuffer
 * @param limit 最大デコード数（省略時は全てデコード）
 * @returns デコードされた複素数配列
 */
export function decodeComplexArray(buffer: ArrayBuffer, limit?: number): Complex[] {
  const view = new Float64Array(buffer);
  const length = limit ? Math.min(limit * 2, view.length) : view.length;
  const complexArray: Complex[] = new Array(Math.floor(length / 2));

  for (let i = 0, j = 0; i < length; i += 2, j++) {
    complexArray[j] = { re: view[i], im: view[i + 1] };
  }

  return complexArray;
}

/**
 * 複素数データを直接Float64Arrayとして扱うためのラッパー
 * オブジェクト生成を避けてメモリ効率を向上
 */
export class ComplexArrayView {
  private view: Float64Array;

  constructor(buffer: ArrayBuffer) {
    this.view = new Float64Array(buffer);
  }

  /**
   * 配列の長さを取得
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

  /**
   * バッファデータを配列に変換（必要な場合のみ使用）
   * @param limit 最大変換数（省略時は全て変換）
   */
  toArray(limit?: number): Complex[] {
    const length = limit ? Math.min(limit, this.length) : this.length;
    const result = new Array(length);

    for (let i = 0; i < length; i++) {
      result[i] = this.get(i);
    }

    return result;
  }
}

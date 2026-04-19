import type { Complex } from "@/math/complex";

export const ITEM_BYTE_LENGTH = 44;

/*
 * lがこれと同値までのblaをスキップする
 * Nが伸びたときにBLATableのデータ量がめっちゃ増えるのを防ぐ
 *
 * 現状は2。ここまでは試してみてほとんど速度変わらなかったから。
 * 4にすると地点によるがN=200000で300msくらい落ちる
 * たぶん
 */
export const SKIP_BLA_ENTRY_UNTIL_THIS_L = 2;

export type BLATableItem = {
  a: Complex;
  b: Complex;
  r: number;
  l: number;
};

// このファイルはほとんどChatGPTくんによって生成されました

export function encodeBlaTableItems(items: BLATableItem[][]): SharedArrayBuffer {
  // 行の数と、それぞれの行の要素数を格納するのに必要なバイト数を加算
  let totalSize = 4; // 最初の4バイトは行の数
  for (let i = 0; i < items.length; i++) {
    totalSize += 4; // 各行の要素数を格納するための4バイト
    totalSize += items[i].length * ITEM_BYTE_LENGTH; // 実際の各行のデータ
  }

  const buffer = new SharedArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // 最初のエントリに行の数を設定
  view.setInt32(0, items.length, true);
  let byteOffset = 4;

  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    view.setInt32(byteOffset, row.length, true);
    byteOffset += 4;

    for (let j = 0; j < row.length; j++) {
      const item = row[j];
      // 中間ArrayBufferを作らず直接SharedArrayBufferに書き込む
      view.setFloat64(byteOffset, item.a.re, true);
      view.setFloat64(byteOffset + 8, item.a.im, true);
      view.setFloat64(byteOffset + 16, item.b.re, true);
      view.setFloat64(byteOffset + 24, item.b.im, true);
      // encode時にr²として保存しておく。hot loopでは|dz|<rの判定をdzNorm < r²で行いたいため
      view.setFloat64(byteOffset + 32, item.r * item.r, true);
      view.setInt32(byteOffset + 40, item.l, true);
      byteOffset += ITEM_BYTE_LENGTH;
    }
  }

  return buffer;
}

/**
 * BLATableを表現するbufferから直接値を取り出せるようにするラッパー
 *
 * # ストレージフォーマット (little-endian)
 *
 * ```
 * [i32]                行数 (= BLATableの段数)
 * 各行:
 *   [i32]              その行の要素数
 *   要素 × 要素数 (1要素あたり ITEM_BYTE_LENGTH = 44 bytes):
 *     [f64]  offset  0 : a.re
 *     [f64]  offset  8 : a.im
 *     [f64]  offset 16 : b.re
 *     [f64]  offset 24 : b.im
 *     [f64]  offset 32 : r²  (注: rではなくr²を格納。hot loopで dzNorm < r² で判定したいため)
 *     [i32]  offset 40 : l
 * ```
 *
 * # アクセス方法
 *
 * hot pathからの直接アクセスを想定しているためget系メソッドは提供しない。
 * 以下のpublicフィールドを直接参照する:
 * - `view`: buffer全体のDataView
 * - `length`: 行数 (BLATableの段数)
 * - `rowOffsets`: 各行の[byteOffset, length]をフラットに格納したInt32Array
 *    - `rowOffsets[rowIdx * 2]`     = その行の先頭要素のbyteOffset
 *    - `rowOffsets[rowIdx * 2 + 1]` = その行の要素数
 *
 * 指定位置 (rowIdx, columnIdx) の要素にアクセスするには:
 * ```ts
 * const byteOffset = rowOffsets[rowIdx * 2] + columnIdx * ITEM_BYTE_LENGTH;
 * const aRe = view.getFloat64(byteOffset,      true);
 * const aIm = view.getFloat64(byteOffset +  8, true);
 * const bRe = view.getFloat64(byteOffset + 16, true);
 * const bIm = view.getFloat64(byteOffset + 24, true);
 * const rSq = view.getFloat64(byteOffset + 32, true);
 * const l   = view.getInt32  (byteOffset + 40, true);
 * ```
 */
export class BLATableView {
  readonly view: DataView;
  readonly length: number;
  readonly rowOffsets: Int32Array;

  constructor(buffer: SharedArrayBuffer) {
    this.view = new DataView(buffer);

    this.length = this.view.getInt32(0, true);

    this.rowOffsets = new Int32Array(this.length * 2);
    let byteOffset = 4; // ↑で読み込んだi32ひとつ分
    for (let idx = 0; idx < this.length; idx++) {
      const rowLength = this.view.getInt32(byteOffset, true);
      this.rowOffsets[idx * 2] = byteOffset + 4; // itemの開始offsetが欲しいのでrowLength分は飛ばす
      this.rowOffsets[idx * 2 + 1] = rowLength;

      // 次のrowLengthのoffsetにセットしておく
      byteOffset += 4 + ITEM_BYTE_LENGTH * rowLength;
    }
  }
}

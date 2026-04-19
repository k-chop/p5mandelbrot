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

export function encodeBlaTableItem(item: BLATableItem): ArrayBuffer {
  const buffer = new ArrayBuffer(ITEM_BYTE_LENGTH);
  const floatView = new Float64Array(buffer, 0, 5); // 8 bytes * 5
  const intView = new Int32Array(buffer, 40, 1); // 4 bytes

  floatView[0] = item.a.re;
  floatView[1] = item.a.im;
  floatView[2] = item.b.re;
  floatView[3] = item.b.im;
  // encode時にr²として保存しておく。hot loopでは|dz|<rの判定をdzNorm < r²で行いたいため
  floatView[4] = item.r * item.r;
  intView[0] = item.l;

  return buffer;
}

export function decodeBLATableItem(view: DataView, offset: number): BLATableItem {
  const aRe = view.getFloat64(offset, true); // a.re
  const aIm = view.getFloat64(offset + 8, true); // a.im
  const bRe = view.getFloat64(offset + 16, true); // b.re
  const bIm = view.getFloat64(offset + 24, true); // b.im
  const rSq = view.getFloat64(offset + 32, true); // r²
  const l = view.getInt32(offset + 40, true); // l

  return {
    a: { re: aRe, im: aIm },
    b: { re: bRe, im: bIm },
    r: Math.sqrt(rSq),
    l,
  };
}

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

export function decodeBLATableItems(buffer: ArrayBuffer): BLATableItem[][] {
  const view = new DataView(buffer);
  const rows = view.getInt32(0, true); // 最初のエントリは行の数
  const items: BLATableItem[][] = [];

  let offset = 1; // Int32のエントリとしてのオフセット

  for (let i = 0; i < rows; i++) {
    const rowLength = view.getInt32(offset * 4, true);
    const rowItems: BLATableItem[] = [];
    offset += 1; // 次の要素数のためにオフセットを1つ進める

    for (let j = 0; j < rowLength; j++) {
      // Int32のエントリではなく、バイトとしてのオフセットを計算する
      const byteOffset = offset * 4;

      rowItems.push(decodeBLATableItem(view, byteOffset));
      offset += ITEM_BYTE_LENGTH / 4; // 次のアイテムのためにオフセットをアイテムのバイト長分進める
    }
    items.push(rowItems);
  }

  return items;
}

/**
 * BLATableを表現するbufferから直接値を取り出せるようにするラッパー
 */
export class BLATableView {
  /** hot pathからの直接アクセス用にpublic。通常はget系メソッドを使うこと。 */
  readonly view: DataView;
  public readonly length: number;
  /**
   * 各行の[byteOffset, length]をフラットに格納。rowOffsets[rowIdx * 2] = byteOffset, rowOffsets[rowIdx * 2 + 1] = length。
   * hot pathからの直接アクセス用にpublic。
   */
  readonly rowOffsets: Int32Array;
  /** getABの結果をアロケーションなしで返すための再利用バッファ */
  readonly abBuffer = new Float64Array(4);

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

  /**
   * 指定した位置のBLAItemが格納されているbyteOffsetを返す
   */
  getBLAItemOffset(rowIdx: number, columnIdx: number) {
    return this.rowOffsets[rowIdx * 2] + columnIdx * ITEM_BYTE_LENGTH;
  }

  /**
   * 指定した位置のrを返す
   */
  getR(rowIdx: number, columnIdx: number) {
    const byteOffset = this.rowOffsets[rowIdx * 2] + columnIdx * ITEM_BYTE_LENGTH;
    // storageにはr²が入っているためsqrtして返す
    return Math.sqrt(this.view.getFloat64(byteOffset + 32, true));
  }

  /**
   * 指定した位置のlを返す
   */
  getL(rowIdx: number, columnIdx: number) {
    const byteOffset = this.rowOffsets[rowIdx * 2] + columnIdx * ITEM_BYTE_LENGTH;
    return this.view.getInt32(byteOffset + 40, true);
  }

  /**
   * 指定した位置のa, bの値をabBufferに書き込んで返す。
   * abBuffer[0]=aRe, [1]=aIm, [2]=bRe, [3]=bIm
   * 呼び出し側は次のgetAB呼び出し前に値を使い切ること。
   */
  getAB(rowIdx: number, columnIdx: number): Float64Array {
    const byteOffset = this.rowOffsets[rowIdx * 2] + columnIdx * ITEM_BYTE_LENGTH;
    const buf = this.abBuffer;

    buf[0] = this.view.getFloat64(byteOffset, true);
    buf[1] = this.view.getFloat64(byteOffset + 8, true);
    buf[2] = this.view.getFloat64(byteOffset + 16, true);
    buf[3] = this.view.getFloat64(byteOffset + 24, true);

    return buf;
  }
}

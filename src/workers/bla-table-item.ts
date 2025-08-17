import type { Complex } from "@/math/complex";

const ITEM_BYTE_LENGTH = 44;

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
  floatView[4] = item.r;
  intView[0] = item.l;

  return buffer;
}

export function decodeBLATableItem(view: DataView, offset: number): BLATableItem {
  const aRe = view.getFloat64(offset, true); // a.re
  const aIm = view.getFloat64(offset + 8, true); // a.im
  const bRe = view.getFloat64(offset + 16, true); // b.re
  const bIm = view.getFloat64(offset + 24, true); // b.im
  const r = view.getFloat64(offset + 32, true); // r
  const l = view.getInt32(offset + 40, true); // l

  return {
    a: { re: aRe, im: aIm },
    b: { re: bRe, im: bIm },
    r,
    l,
  };
}

export function encodeBlaTableItems(items: BLATableItem[][]): SharedArrayBuffer {
  // 行の数と、それぞれの行の要素数を格納するのに必要なバイト数を加算
  let totalSize = 4; // 最初の4バイトは行の数
  items.forEach((row) => {
    totalSize += 4; // 各行の要素数を格納するための4バイト
    totalSize += row.length * ITEM_BYTE_LENGTH; // 実際の各行のデータ
  });

  const buffer = new SharedArrayBuffer(totalSize);
  const view = new Int32Array(buffer);

  // 最初のエントリに行の数を設定
  view[0] = items.length;
  let offset = 1; // Int32のエントリとしてのオフセット

  items.forEach((row) => {
    view[offset] = row.length; // 各行の要素数を設定
    offset += 1; // 次の要素数のためにオフセットを1つ進める

    row.forEach((item) => {
      const itemBuffer = encodeBlaTableItem(item);
      // Int32のエントリではなく、バイトとしてのオフセットを計算する必要がある
      const byteOffset = offset * 4;
      new Uint8Array(buffer, byteOffset, ITEM_BYTE_LENGTH).set(new Uint8Array(itemBuffer));
      offset += ITEM_BYTE_LENGTH / 4; // 次のアイテムのためにオフセットをアイテムのバイト長分進める
    });
  });

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
  private view: DataView;
  public readonly length: number;
  public readonly offsetMap: { [rowIndex: number]: { byteOffset: number; length: number } };

  constructor(buffer: SharedArrayBuffer) {
    this.view = new DataView(buffer);

    this.length = this.view.getInt32(0, true);

    this.offsetMap = {};
    let byteOffset = 4; // ↑で読み込んだi32ひとつ分
    for (let idx = 0; idx < this.length; idx++) {
      const rowLength = this.view.getInt32(byteOffset, true);
      this.offsetMap[idx] = {
        byteOffset: byteOffset + 4, // itemの開始offsetが欲しいのでrowLength分は飛ばす
        length: rowLength,
      };

      // 次のrowLengthのoffsetにセットしておく
      byteOffset += 4 + ITEM_BYTE_LENGTH * rowLength;
    }
  }

  /**
   * 指定した位置のBLAItemが格納されているbyteOffsetを返す
   */
  getBLAItemOffset(rowIdx: number, columnIdx: number) {
    const { byteOffset, length } = this.offsetMap[rowIdx];
    if (columnIdx > length)
      throw new Error(`Invalid offset specified: row: ${rowIdx}, ${columnIdx} > ${length}`);

    return byteOffset + columnIdx * ITEM_BYTE_LENGTH;
  }

  getR(rowIdx: number, columnIdx: number) {
    const byteOffset = this.getBLAItemOffset(rowIdx, columnIdx);
    return this.view.getFloat64(byteOffset + 32, true);
  }

  getL(rowIdx: number, columnIdx: number) {
    const byteOffset = this.getBLAItemOffset(rowIdx, columnIdx);
    return this.view.getInt32(byteOffset + 40, true); // l
  }

  getAB(rowIdx: number, columnIdx: number) {
    const byteOffset = this.getBLAItemOffset(rowIdx, columnIdx);

    const aRe = this.view.getFloat64(byteOffset, true);
    const aIm = this.view.getFloat64(byteOffset + 8, true);
    const bRe = this.view.getFloat64(byteOffset + 16, true);
    const bIm = this.view.getFloat64(byteOffset + 24, true);

    return { aRe, aIm, bRe, bIm };
  }
}

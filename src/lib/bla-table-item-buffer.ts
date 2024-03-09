import { BLATableItem } from "@/math";

const ITEM_BYTE_LENGTH = 44;

// このファイルはほとんどChatGPTくんによって生成されました

export function blaTableItemToBuffer(item: BLATableItem): ArrayBuffer {
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

export function bufferToBLATableItem(buffer: ArrayBuffer): BLATableItem {
  const floatView = new Float64Array(buffer, 0, 5);
  const intView = new Int32Array(buffer, 40, 1);

  return {
    a: { re: floatView[0], im: floatView[1] },
    b: { re: floatView[2], im: floatView[3] },
    r: floatView[4],
    l: intView[0],
  };
}

export function blaTableItemsToBuffer(items: BLATableItem[][]): ArrayBuffer {
  // 行の数と、それぞれの行の要素数を格納するのに必要なバイト数を加算
  let totalSize = 4; // 最初の4バイトは行の数
  items.forEach((row) => {
    totalSize += 4; // 各行の要素数を格納するための4バイト
    totalSize += row.length * ITEM_BYTE_LENGTH; // 実際の各行のデータ
  });

  const buffer = new ArrayBuffer(totalSize);
  const view = new Int32Array(buffer);

  // 最初のエントリに行の数を設定
  view[0] = items.length;
  let offset = 1; // Int32のエントリとしてのオフセット

  items.forEach((row) => {
    view[offset] = row.length; // 各行の要素数を設定
    offset += 1; // 次の要素数のためにオフセットを1つ進める

    row.forEach((item) => {
      const itemBuffer = blaTableItemToBuffer(item);
      // Int32のエントリではなく、バイトとしてのオフセットを計算する必要がある
      const byteOffset = offset * 4;
      new Uint8Array(buffer, byteOffset, ITEM_BYTE_LENGTH).set(
        new Uint8Array(itemBuffer),
      );
      offset += ITEM_BYTE_LENGTH / 4; // 次のアイテムのためにオフセットをアイテムのバイト長分進める
    });
  });

  return buffer;
}

export function bufferToBLATableItems(buffer: ArrayBuffer): BLATableItem[][] {
  const view = new Int32Array(buffer);
  const rows = view[0]; // 最初のエントリは行の数
  const items: BLATableItem[][] = [];

  let offset = 1; // Int32のエントリとしてのオフセット

  for (let i = 0; i < rows; i++) {
    const rowLength = view[offset];
    const rowItems: BLATableItem[] = [];
    offset += 1; // 次の要素数のためにオフセットを1つ進める

    for (let j = 0; j < rowLength; j++) {
      // Int32のエントリではなく、バイトとしてのオフセットを計算する
      const byteOffset = offset * 4;
      const itemBuffer = buffer.slice(
        byteOffset,
        byteOffset + ITEM_BYTE_LENGTH,
      );
      rowItems.push(bufferToBLATableItem(itemBuffer));
      offset += ITEM_BYTE_LENGTH / 4; // 次のアイテムのためにオフセットをアイテムのバイト長分進める
    }
    items.push(rowItems);
  }

  return items;
}

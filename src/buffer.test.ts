import { describe, expect, it } from "vitest";
import { copyBufferRectToRect } from "./buffer";

describe("copyBufferRectToRect", () => {
  it("srcがdestに収まる場合", () => {
    const dest = new Uint32Array(3 * 3);
    const src = Uint32Array.from([1, 2, 3, 4]);

    copyBufferRectToRect(dest, src, 3, 2, 2, 2, 1, 1, 0, 0);

    const expected = Uint32Array.from([0, 0, 0, 0, 1, 2, 0, 3, 4]);
    expect(expected).toEqual(dest);
  });

  it("dest側ではみだした部分は無視される", () => {
    const dest = new Uint32Array(2 * 2);
    const src = Uint32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    copyBufferRectToRect(dest, src, 2, 3, 3, 3, 1, 1, 0, 0);

    const expected = Uint32Array.from([0, 0, 0, 1]);
    expect(expected).toEqual(dest);
  });

  it("srcの一部だけコピーする", () => {
    const dest = new Uint32Array(3 * 3);
    const src = Uint32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    copyBufferRectToRect(dest, src, 3, 3, 2, 2, 0, 0, 1, 1);

    const expected = Uint32Array.from([5, 6, 0, 8, 9, 0, 0, 0, 0]);
    expect(expected).toEqual(dest);
  });
});

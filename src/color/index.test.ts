import { repeatUntil } from "@/math/util";
import { interpolateRdYlBu } from "d3-scale-chromatic";
import { describe, expect, it } from "vitest";
import { ChromaJsPalette } from "./color-chromajs";
import { D3ChromaticPalette } from "./color-d3-chromatic";
import { OthersPalette, othersPalettes } from "./color-others";
import { deserializePalette } from "./deserializer";

describe("chroma-js", () => {
  it("不正な入力に対してデフォルト値を適用する", () => {
    const palette = new ChromaJsPalette([], -1);
    const serialized = palette.serialize();
    expect(serialized).toBe("chroma-js,2,black,white,1,1,0");
  });

  it("serializeできる", () => {
    const palette = new ChromaJsPalette(["lightblue", "navy", "white"], 128);
    const serialized = palette.serialize();
    expect(serialized).toBe("chroma-js,3,lightblue,navy,white,1,128,0");
  });

  it("deserializeできる", () => {
    const serialized = "chroma-js,3,lightblue,navy,white,1,128,0";
    const palette = deserializePalette(serialized);
    const serialized2 = palette.serialize();
    expect(serialized2).toBe(serialized);
  });

  it("deserialize時にlength, offsetの不正な入力は丸められる", () => {
    const serialized = "chroma-js,3,lightblue,navy,white,-1,128128128,-42";
    const palette = deserializePalette(serialized);
    const serialized2 = palette.serialize();
    expect(serialized2).toBe("chroma-js,3,lightblue,navy,white,0,8192,0");
  });

  it("deserialize時に16以上の長さのpalette指定は切り捨てられる", () => {
    const colors = repeatUntil(["black", "red", "yellow"], 16);
    const overColors = [...colors, "white"];

    const serialized = `chroma-js,17,${overColors.join(",")},1,128,0`;
    const palette = deserializePalette(serialized);
    const serialized2 = palette.serialize();
    expect(serialized2).toBe(`chroma-js,16,${colors.join(",")},1,128,0`);
  });

  it("deserialize時に不正な入力を与えられた場合はデフォルトのパレットを返す", () => {
    const serialized = "chroma-js,asd,asd,qwe,wer,ert,rty,xcv,sdf,asd";
    const palette = deserializePalette(serialized);
    const serialized2 = palette.serialize();
    expect(serialized2).toBe("chroma-js,2,black,white,0,16,0");
  });
});

describe("d3-chromatic", () => {
  it("不正な入力に対してデフォルト値を適用する", () => {
    const palette = new D3ChromaticPalette(interpolateRdYlBu, -1, true, -512);
    const serialized = palette.serialize();
    expect(serialized).toBe("d3-chromatic,RdYlBlu,1,1,0");
  });

  it("serializeできる", () => {
    const palette = new D3ChromaticPalette(interpolateRdYlBu, 128, true, 8);
    expect(palette.serialize()).toBe("d3-chromatic,RdYlBlu,1,128,8");
  });

  it("deserializeできる", () => {
    const serialized = "d3-chromatic,RdYlBlu,1,128,8";
    const palette = deserializePalette(serialized);
    const serialized2 = palette.serialize();
    expect(serialized2).toBe(serialized);
  });

  it("deserialize時に不正な入力を与えられた場合はデフォルトのパレットを返す", () => {
    const serialized = "d3-chromatic,asd,asd,asd,asd,asd";
    const palette = deserializePalette(serialized);
    const serialized2 = palette.serialize();
    expect(serialized2).toBe("d3-chromatic,RdYlBlu,0,1,0");
  });
});

describe("othersPalette", () => {
  it("不正な入力に対してデフォルト値を適用する", () => {
    const palette = new OthersPalette(
      -1,
      () => ({ mode: "hsv", h: 0, s: 0, v: 0 }),
      true,
      -512,
    );
    const serialized = palette.serialize();
    expect(serialized).toBe("others,hue360,1,1,0");
  });

  it("serializeできる", () => {
    const palette = othersPalettes[0];
    const serialized = palette.serialize();
    expect(serialized).toBe("others,hue360,1,128,0");
  });

  it("deserializeできる", () => {
    const serialized = "others,hue360,1,128,0";
    const palette = deserializePalette(serialized);
    const serialized2 = palette.serialize();
    expect(serialized2).toBe(serialized);
  });

  it("deserialize時に不正な入力を与えられた場合はデフォルトのパレットを返す", () => {
    const serialized = "others,asd,asd,asd,asd,asd,asd,asd";
    const palette = deserializePalette(serialized);
    const serialized2 = palette.serialize();
    expect(serialized2).toBe("others,hue360,0,1,0");
  });
});

import { Complex } from "@/math";

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

export function decodeComplexArray(buffer: ArrayBuffer): Complex[] {
  const complexArray: Complex[] = [];
  const view = new Float64Array(buffer);

  for (let i = 0; i < view.length; i += 2) {
    complexArray.push({ re: view[i], im: view[i + 1] });
  }

  return complexArray;
}

import BigNumber from "bignumber.js";

export const PRECISION = 310;

export type Complex = {
  re: number;
  im: number;
};

export type ComplexArbitrary = {
  re: BigNumber;
  im: BigNumber;
};

export function complexArbitary(
  real: BigNumber.Value,
  imaginary: BigNumber.Value,
): ComplexArbitrary {
  return {
    re: new BigNumber(real),
    im: new BigNumber(imaginary),
  };
}

export function complex(real: number, imaginary: number): Complex {
  return {
    re: real,
    im: imaginary,
  };
}

export function norm(n: Complex): number {
  return n.re * n.re + n.im * n.im;
}

export function nNorm(re: number, im: number): number {
  return re * re + im * im;
}

export function dNorm(n: ComplexArbitrary): BigNumber {
  return n.re.times(n.re).plus(n.im.times(n.im));
}

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function dMul(
  a: ComplexArbitrary,
  b: ComplexArbitrary | number,
): ComplexArbitrary {
  if (typeof b === "number") {
    return {
      re: a.re.times(b),
      im: a.im.times(b),
    };
  } else {
    return {
      re: a.re.times(b.re).minus(a.im.times(b.im)),
      im: a.re.times(b.im).plus(a.im.times(b.re)),
    };
  }
}

export function mul(a: Complex, b: Complex, coef = 1.0): Complex {
  return {
    re: coef * (a.re * b.re - a.im * b.im),
    im: coef * (a.re * b.im + a.im * b.re),
  };
}

export function mulN(a: Complex, b: number): Complex {
  return {
    re: a.re * b,
    im: a.im * b,
  };
}

export function mulRe(
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number,
): number {
  return aRe * bRe - aIm * bIm;
}

export function mulIm(
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number,
): number {
  return aRe * bIm + aIm * bRe;
}

export function dSquare(n: ComplexArbitrary): ComplexArbitrary {
  return {
    re: n.re.times(n.re).minus(n.im.times(n.im)),
    im: n.re.times(n.im).times(2),
  };
}

export function square(n: Complex): Complex {
  return {
    re: n.re * n.re - n.im * n.im,
    im: n.re * n.im * 2,
  };
}

export function dAdd(
  a: ComplexArbitrary,
  b: ComplexArbitrary | Complex,
): ComplexArbitrary {
  return {
    re: a.re.plus(b.re),
    im: a.im.plus(b.im),
  };
}

export function dSub(
  a: ComplexArbitrary,
  b: ComplexArbitrary | Complex,
): ComplexArbitrary {
  return {
    re: a.re.minus(b.re),
    im: a.im.minus(b.im),
  };
}

export function dReduce(a: ComplexArbitrary): ComplexArbitrary {
  return {
    re: a.re.sd(PRECISION),
    im: a.im.sd(PRECISION),
  };
}

export function toComplex(n: ComplexArbitrary): Complex {
  return { re: n.re.toNumber(), im: n.im.toNumber() };
}

export function* seqGenerator(n: number) {
  let i = n;
  while (i > 1) {
    yield i;
    i = Math.floor(i / 2);
  }
  yield 1;
}

export function dividerSequence(n: number) {
  const result = [];
  for (const i of seqGenerator(n)) {
    result.push(i);
  }
  // 最初の2要素は荒すぎるので落とす
  return result.slice(2);
}

/**
 * できるだけ等間隔に要素を取りつつ指定した長さに縮める
 */
export function thin<T>(arr: T[], length: number): T[] {
  if (length >= arr.length || length < 3) {
    return arr;
  }

  const result = [arr[0]];
  const interval = (arr.length - 1) / (length - 1);

  for (let i = 1; i < length - 1; i++) {
    result.push(arr[Math.round(i * interval)]);
  }

  result.push(arr[arr.length - 1]);

  return result;
}

export function generateLowResDiffSequence(
  resolutionCount: number,
  areaWidth: number,
  areaHeight: number,
) {
  let xDiffs = thin(dividerSequence(areaWidth), resolutionCount);
  let yDiffs = thin(dividerSequence(areaHeight), resolutionCount);

  if (xDiffs.length !== yDiffs.length) {
    const minLen = Math.min(xDiffs.length, yDiffs.length);
    xDiffs = thin(xDiffs, minLen);
    yDiffs = thin(yDiffs, minLen);
  }

  return { xDiffs, yDiffs };
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function repeatUntil<T>(base: T[], length: number) {
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(base[i % base.length]);
  }
  return result;
}

export function safeParseInt(value: string, defaultValue = 0): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

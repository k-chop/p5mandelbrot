import BigNumber from "bignumber.js";

export const PRECISION = 100;

export type Complex = {
  r: number;
  i: number;
};

export type ComplexArbitrary = {
  r: BigNumber;
  i: BigNumber;
};

export function complexArbitary(
  real: BigNumber.Value,
  imaginary: BigNumber.Value
): ComplexArbitrary {
  return {
    r: new BigNumber(real),
    i: new BigNumber(imaginary),
  };
}

export function complex(real: number, imaginary: number): Complex {
  return {
    r: real,
    i: imaginary,
  };
}

export function norm(n: Complex): number {
  return n.r * n.r + n.i * n.i;
}

export function nNorm(re: number, im: number): number {
  return re * re + im * im;
}

export function add(a: Complex, b: Complex): Complex {
  return { r: a.r + b.r, i: a.i + b.i };
}

export function dmul(
  a: ComplexArbitrary,
  b: ComplexArbitrary | number
): ComplexArbitrary {
  if (typeof b === "number") {
    return {
      r: a.r.times(b),
      i: a.i.times(b),
    };
  } else {
    return {
      r: a.r.times(b.r).minus(a.i.times(b.i)),
      i: a.r.times(b.i).plus(a.i.times(b.r)),
    };
  }
}

export function mul(a: Complex, b: Complex): Complex {
  return {
    r: a.r * b.r - a.i * b.i,
    i: a.r * b.i + a.i * b.r,
  };
}

export function mulRe(
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number
): number {
  return aRe * bRe - aIm * bIm;
}

export function mulIm(
  aRe: number,
  aIm: number,
  bRe: number,
  bIm: number
): number {
  return aRe * bIm + aIm * bRe;
}

export function dsquare(n: ComplexArbitrary): ComplexArbitrary {
  return {
    r: n.r.times(n.r).minus(n.i.times(n.i)),
    i: n.r.times(n.i).times(2),
  };
}

export function square(n: Complex): Complex {
  return {
    r: n.r * n.r - n.i * n.i,
    i: n.r * n.i * 2,
  };
}

export function dadd(
  a: ComplexArbitrary,
  b: ComplexArbitrary | Complex
): ComplexArbitrary {
  return {
    r: a.r.plus(b.r),
    i: a.i.plus(b.i),
  };
}

export function dsub(
  a: ComplexArbitrary,
  b: ComplexArbitrary | Complex
): ComplexArbitrary {
  return {
    r: a.r.minus(b.r),
    i: a.i.minus(b.i),
  };
}

export function dreduce(a: ComplexArbitrary): ComplexArbitrary {
  return {
    r: a.r.sd(PRECISION),
    i: a.i.sd(PRECISION),
  };
}

export function toComplex(n: ComplexArbitrary): Complex {
  return { r: n.r.toNumber(), i: n.i.toNumber() };
}

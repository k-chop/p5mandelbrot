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
  real: number,
  imaginary: number
): ComplexArbitrary {
  return {
    r: new BigNumber(real),
    i: new BigNumber(imaginary),
  };
}

export function norm(n: Complex): number {
  return n.r * n.r + n.i * n.i;
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

export function square(n: ComplexArbitrary): ComplexArbitrary {
  return {
    r: n.r.times(n.r).minus(n.i.times(n.i)),
    i: n.r.times(n.i).times(2),
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

export function dreduce(a: ComplexArbitrary): ComplexArbitrary {
  return {
    r: a.r.sd(PRECISION),
    i: a.i.sd(PRECISION),
  };
}

export function toComplex(n: ComplexArbitrary): Complex {
  return { r: n.r.toNumber(), i: n.i.toNumber() };
}

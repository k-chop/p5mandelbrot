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

export function dMul(a: ComplexArbitrary, b: ComplexArbitrary | number): ComplexArbitrary {
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

export function mulRe(aRe: number, aIm: number, bRe: number, bIm: number): number {
  return aRe * bRe - aIm * bIm;
}

export function mulIm(aRe: number, aIm: number, bRe: number, bIm: number): number {
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

export function dAdd(a: ComplexArbitrary, b: ComplexArbitrary | Complex): ComplexArbitrary {
  return {
    re: a.re.plus(b.re),
    im: a.im.plus(b.im),
  };
}

export function dSub(a: ComplexArbitrary, b: ComplexArbitrary | Complex): ComplexArbitrary {
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

/**
 * pixel座標を複素数座標に変換する
 */
export function pixelToComplexCoordinateComplexArbitrary(
  pixelX: number,
  pixelY: number,
  c: ComplexArbitrary,
  r: BigNumber,
  pixelWidth: number,
  pixelHeight: number,
): ComplexArbitrary {
  const scaleX = pixelWidth / Math.min(pixelWidth, pixelHeight);
  const scaleY = pixelHeight / Math.min(pixelWidth, pixelHeight);

  return {
    re: c.re.plus(
      new BigNumber(pixelX).times(2).div(pixelWidth).minus(1).times(r).times(scaleX).sd(PRECISION),
    ),
    im: c.im.minus(
      new BigNumber(pixelY).times(2).div(pixelHeight).minus(1).times(r).times(scaleY).sd(PRECISION),
    ),
  };
}

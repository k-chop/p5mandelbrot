declare module "double.js" {
  type Double = {
    new (value: number | string): DoubleJS;
    add: (value: DoubleJS | number) => DoubleJS;
    mul: (value: DoubleJS | number) => DoubleJS;
    sub: (value: DoubleJS | number) => DoubleJS;
    div: (value: DoubleJS | number) => DoubleJS;
    pow: (value: DoubleJS | number) => DoubleJS;
    pown: (value: number) => DoubleJS;
    abs: () => DoubleJS;
    neg: () => DoubleJS;
    inv: () => DoubleJS;
    sqr: () => DoubleJS;
    sqrt: () => DoubleJS;
    exp: () => DoubleJS;
    ln: () => DoubleJS;
    sinh: () => DoubleJS;
    cosh: () => DoubleJS;
    eq: (value: DoubleJS | number) => boolean;
    ne: (value: DoubleJS | number) => boolean;
    gt: (value: DoubleJS | number) => boolean;
    ge: (value: DoubleJS | number) => boolean;
    lt: (value: DoubleJS | number) => boolean;
    le: (value: DoubleJS | number) => boolean;
    toNumber: () => number;
    toExponential: (fractionDigits?: number) => string;
  };

  const Double: Double;
}

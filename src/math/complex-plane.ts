import BigNumber from "bignumber.js";
import { ComplexArbitrary, PRECISION } from "../math";

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
      new BigNumber(pixelX)
        .times(2)
        .div(pixelWidth)
        .minus(1)
        .times(r)
        .times(scaleX)
        .sd(PRECISION),
    ),
    im: c.im.minus(
      new BigNumber(pixelY)
        .times(2)
        .div(pixelHeight)
        .minus(1)
        .times(r)
        .times(scaleY)
        .sd(PRECISION),
    ),
  };
}

export const copyBufferRectToRect = (
  dest: Uint32Array,
  src: Uint32Array,
  destWidth: number,
  srcWidth: number,
  clipWidth: number,
  clipHeight: number,
  destX: number,
  destY: number,
  srcX: number,
  srcY: number
) => {
  const destHeight = Math.floor(dest.length / destWidth);

  const actualHeight = Math.min(clipHeight, destHeight - destY);
  const actualWidth = Math.min(clipWidth, destWidth - destX);

  for (let y = 0; y < actualHeight; y++) {
    const srcOffset = (y + srcY) * srcWidth + srcX;
    const srcLine = src.subarray(srcOffset, srcOffset + actualWidth);
    const destOffset = (y + destY) * destWidth + destX;
    dest.set(srcLine, destOffset);
  }
};

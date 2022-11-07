export const copyBufferAsRect = (
  dest: Uint32Array,
  src: Uint32Array,
  destWidth: number,
  startX: number,
  endX: number,
  startY: number,
  endY: number
) => {
  const srcHeight = endY - startY;

  for (let srcY = 0; srcY < srcHeight; srcY++) {
    const srcWidth = endX - startX;
    const destOffset = (srcY + startY) * destWidth + startX;
    dest.set(src.subarray(srcWidth * srcY, srcWidth * (srcY + 1)), destOffset);
  }
};

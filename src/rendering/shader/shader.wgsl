struct Uniforms {
  maxIterations: u32,
  canvasWidth: u32,
  canvasHeight: u32,
  paletteOffset: u32,
  paletteSize: u32,
  offsetX: u32,
  offsetY: u32,
  width: u32,
  height: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage> iterations: array<u32>;
@group(0) @binding(2) var<storage> palette: array<vec4f>;

@vertex
fn vertexMain(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  return vec4f(pos, 0.0, 1.0);
}

@fragment
fn fragmentMain(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let x = u32(fragCoord.x) - uniforms.offsetX;
  let y = u32(fragCoord.y) - uniforms.offsetY;
 
  if (x < 0 || uniforms.width <= x || y < 0 || uniforms.height <= y) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }

  let index = y * uniforms.canvasWidth + x;
  let iteration = iterations[index];
  
  if (iteration >= uniforms.maxIterations) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }

  let paletteLength = uniforms.paletteSize * 2 - 2;
  let offsettedIndex = (iteration + uniforms.paletteOffset) % paletteLength;
  
  if (offsettedIndex < uniforms.paletteSize) {
    return palette[offsettedIndex];
  } else {
    return palette[paletteLength - offsettedIndex];
  }
}

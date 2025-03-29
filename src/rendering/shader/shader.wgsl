struct Uniforms {
  maxIterations: f32,
  canvasWidth: f32,
  canvasHeight: f32,
  paletteOffset: f32,
  paletteSize: f32,
  offsetX: f32,
  offsetY: f32,
  width: f32,
  height: f32,
  iterationBufferCount: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> iterations: array<u32>;
@group(0) @binding(2) var<storage> palette: array<vec4f>;
// @group(0) @binding(3) var<storage> iterInput: array<u32>;
// @group(0) @binding(4) var<storage> iterInputMeta: array<u32>;

@vertex
fn vertexMain(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  return vec4f(pos, 0.0, 1.0);
}

@fragment
fn fragmentMain(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let dx = i32(fragCoord.x) - i32(uniforms.offsetX);
  let dy = i32(fragCoord.y) - i32(uniforms.offsetY);

  let x = f32(dx) * (uniforms.canvasWidth / uniforms.width);
  let y = f32(dy) * (uniforms.canvasHeight / uniforms.height);

  if (x < 0 || uniforms.canvasWidth <= x || y < 0 || uniforms.canvasHeight <= y) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }

  let index = i32(y) * i32(uniforms.canvasWidth) + i32(x);
  let iteration = iterations[index];
  
  if (iteration >= u32(uniforms.maxIterations)) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }

  let paletteLength = u32(uniforms.paletteSize) * 2 - 2;
  let offsettedIndex = (iteration + u32(uniforms.paletteOffset)) % paletteLength;
  
  if (offsettedIndex < u32(uniforms.paletteSize)) {
    return palette[offsettedIndex];
  } else {
    return palette[paletteLength - offsettedIndex];
  }
}

struct Uniforms {
  maxIterations: u32,
  width: u32,
  height: u32,
  paletteOffset: u32,
  paletteSize: u32,
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
  let x = u32(fragCoord.x);
  let y = u32(fragCoord.y);
  
  if (x >= uniforms.width || y >= uniforms.height) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }
  
  let index = y * uniforms.width + x;
  let iteration = iterations[index];
  
  if (iteration >= uniforms.maxIterations) {
    return vec4f(0.0, 0.0, 0.0, 1.0);
  }
  
  return palette[((iteration + uniforms.paletteOffset) % uniforms.paletteSize) * 4];
}

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

struct IterationInputMeta {
  x: u32,
  y: u32,
  width: u32,
  height: u32,
  resolutionWidth: u32,
  resolutionHeight: u32,
  length: u32, // element length (not byte)
  isSuperSampled: u32, // 0 or 1
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> iterations: array<u32>;
// @group(0) @binding(2) var<storage> palette: array<vec4f>;
@group(0) @binding(3) var<storage> iterInput: array<u32>;
@group(0) @binding(4) var<storage> iterInputMeta: array<u32>;

fn isValidIdx(idx: i32, length: i32) -> bool {
  return idx >= 0 && idx < length;
}

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  // 
};

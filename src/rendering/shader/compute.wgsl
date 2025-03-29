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
  let thread_id = global_id.x;
  
  let thread_count = u32(uniforms.iterationBufferCount);
  if (thread_id >= thread_count) {
    return;
  }
  
  let meta_offset = thread_id * 8;
  let rect_x = i32(iterInputMeta[meta_offset]);
  let rect_y = i32(iterInputMeta[meta_offset + 1]);
  let rect_width = i32(iterInputMeta[meta_offset + 2]);
  let rect_height = i32(iterInputMeta[meta_offset + 3]);
  let resolution_width = i32(iterInputMeta[meta_offset + 4]);
  let resolution_height = i32(iterInputMeta[meta_offset + 5]);
  let buffer_length = i32(iterInputMeta[meta_offset + 6]);
  let is_super_sampled = i32(iterInputMeta[meta_offset + 7]);
  
  var data_start = 0;
  for (var i = 0; i < i32(thread_id); i++) {
    let prev_length = i32(iterInputMeta[i * 8 + 6]);
    data_start += prev_length;
  }
  
  let canvas_width = i32(uniforms.canvasWidth);
  
  for (var world_y = rect_y; world_y < rect_y + rect_height; world_y++) {
    for (var world_x = rect_x; world_x < rect_x + rect_width; world_x++) {
      let local_x = world_x - rect_x;
      let local_y = world_y - rect_y;
      
      let ratio_x = f32(resolution_width) / f32(rect_width);
      let ratio_y = f32(resolution_height) / f32(rect_height);
      
      let scaled_x = i32(f32(local_x) * ratio_x);
      let scaled_y = i32(f32(local_y) * ratio_y);
      
      let idx = scaled_x + scaled_y * resolution_width;
      let world_idx = world_y * canvas_width + world_x;
      
      if (idx < buffer_length && isValidIdx(world_idx, i32(uniforms.canvasWidth * uniforms.canvasHeight))) {
        iterations[world_idx] = iterInput[data_start + idx];
      }
    }
  }
};

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
  totalPixelCount: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> iterations: array<u32>;
// @group(0) @binding(2) var<storage> palette: array<vec4f>;
@group(0) @binding(3) var<storage> iterInput: array<u32>;
@group(0) @binding(4) var<storage> iterInputMeta: array<f32>;

// metadata 1エントリあたりのf32数。webgpu-renderer.ts の META_STRIDE と一致させること
const META_STRIDE: u32 = 14u;

const FIELD_RECT_X: u32 = 0u;
const FIELD_RECT_Y: u32 = 1u;
const FIELD_RECT_WIDTH: u32 = 2u;
const FIELD_RECT_HEIGHT: u32 = 3u;
const FIELD_RESOLUTION_WIDTH: u32 = 4u;
const FIELD_RESOLUTION_HEIGHT: u32 = 5u;
const FIELD_BUFFER_LENGTH: u32 = 6u;
// const FIELD_IS_SUPER_SAMPLED: u32 = 7u;
const FIELD_DATA_START: u32 = 8u;
const FIELD_PIXEL_START: u32 = 9u;
const FIELD_CLIP_X: u32 = 10u;
const FIELD_CLIP_Y: u32 = 11u;
const FIELD_CLIP_WIDTH: u32 = 12u;

const WORKGROUP_SIZE: u32 = 64u;

fn isValidIdx(idx: i32, length: i32) -> bool {
  return idx >= 0 && idx < length;
}

fn readMeta(entry: u32, field: u32) -> f32 {
  return iterInputMeta[entry * META_STRIDE + field];
}

/**
 * 宛先ピクセルの通し番号 p が属するmetadataエントリを二分探索する
 *
 * pixelStart は各エントリのクリップ後ピクセル数の前置和なので、
 * pixelStart[entry] <= p を満たす最大のentryが答えになる。
 * クリップ後の面積が0のエントリは pixelStart が次のエントリと同値になるため、
 * 「最大のentry」を選ぶことで自然にスキップされる (= clipWidthが0のエントリは選ばれない)。
 */
fn findEntry(p: u32, entryCount: u32) -> u32 {
  var lo = 0u;
  var hi = entryCount - 1u;

  while (lo < hi) {
    let mid = (lo + hi + 1u) / 2u;
    if (u32(readMeta(mid, FIELD_PIXEL_START)) <= p) {
      lo = mid;
    } else {
      hi = mid - 1u;
    }
  }

  return lo;
}

@compute @workgroup_size(64)
fn computeMain(
  @builtin(global_invocation_id) global_id: vec3u,
  @builtin(num_workgroups) num_workgroups: vec3u,
) {
  let entryCount = u32(uniforms.iterationBufferCount);
  if (entryCount == 0u) {
    return;
  }

  let total = u32(uniforms.totalPixelCount);
  // dispatch数はworkgroup数の上限で頭打ちにしているので、足りない分はgrid-strideで回す
  let threadStride = num_workgroups.x * WORKGROUP_SIZE;

  let canvas_width = i32(uniforms.canvasWidth);
  let canvas_height = i32(uniforms.canvasHeight);

  for (var p = global_id.x; p < total; p += threadStride) {
    let entry = findEntry(p, entryCount);

    let clip_x = i32(readMeta(entry, FIELD_CLIP_X));
    let clip_y = i32(readMeta(entry, FIELD_CLIP_Y));
    let clip_width = i32(readMeta(entry, FIELD_CLIP_WIDTH));

    // エントリ内のローカル通し番号から宛先ピクセル座標を復元する
    let localIndex = i32(p - u32(readMeta(entry, FIELD_PIXEL_START)));
    let world_x = clip_x + localIndex % clip_width;
    let world_y = clip_y + localIndex / clip_width;

    let rect_x = i32(readMeta(entry, FIELD_RECT_X));
    let rect_y = i32(readMeta(entry, FIELD_RECT_Y));
    let rect_width = i32(readMeta(entry, FIELD_RECT_WIDTH));
    let rect_height = i32(readMeta(entry, FIELD_RECT_HEIGHT));
    let resolution_width = i32(readMeta(entry, FIELD_RESOLUTION_WIDTH));
    let resolution_height = i32(readMeta(entry, FIELD_RESOLUTION_HEIGHT));
    let buffer_length = i32(readMeta(entry, FIELD_BUFFER_LENGTH));
    let data_start = i32(readMeta(entry, FIELD_DATA_START));

    let ratio_x = f32(resolution_width) / f32(rect_width);
    let ratio_y = f32(resolution_height) / f32(rect_height);

    let scaled_x = i32(f32(world_x - rect_x) * ratio_x);
    let scaled_y = i32(f32(world_y - rect_y) * ratio_y);

    let idx = scaled_x + scaled_y * resolution_width;
    let world_idx = world_y * canvas_width + world_x;

    if (idx < buffer_length && isValidIdx(world_idx, canvas_width * canvas_height)) {
      iterations[world_idx] = iterInput[data_start + idx];
    }
  }
}

//! perturbation + BLA による iteration 計算の hot loop。
//!
//! JS 側 (`src/workers/mandelbrot-perturbation-worker.ts`) からは worker ごとに
//! 1 インスタンスだけ使われる。呼び出し順は
//! `alloc_job` → (ptr 経由で xn / BLA をコピー) → `begin_iteration_job`
//! → `begin_pass` → `calc_iteration_band` ... の繰り返し。

use std::cell::RefCell;
use wasm_bindgen::prelude::*;

/// BLATable 1 要素のバイト数。`src/workers/bla-table-item.ts` の ITEM_BYTE_LENGTH と一致させる
const ITEM_BYTE_LENGTH: usize = 44;
/// bailout 判定に使う半径の 2 乗
const BAILOUT_RADIUS: f64 = 4.0;

/// 1 job 分の入力バッファと計算パラメータ。job をまたいで再利用し、足りないときだけ伸ばす
struct JobContext {
    xn: Vec<f64>,
    bla_bytes: Vec<u8>,
    bla_row_offsets: Vec<i32>,
    iterations: Vec<u32>,
    scaled_iterations: Vec<u32>,

    max_iteration: u32,
    max_ref_iteration: u32,
    bla_rows: i32,
    start_bla_index: i32,
    delta_c_scale: f64,
    ref_pixel_x: f64,
    ref_pixel_y: f64,

    area_width: u32,
    area_height: u32,
    area_start_x: i32,
    area_start_y: i32,

    x_diff: f64,
    y_diff: f64,
    scaled_width: u32,
    is_super_sampling: bool,
    is_result_pass: bool,

    calculated_count: u32,
    hit_count: u32,
}

impl JobContext {
    const fn new() -> Self {
        Self {
            xn: Vec::new(),
            bla_bytes: Vec::new(),
            bla_row_offsets: Vec::new(),
            iterations: Vec::new(),
            scaled_iterations: Vec::new(),
            max_iteration: 0,
            max_ref_iteration: 0,
            bla_rows: 0,
            start_bla_index: 0,
            delta_c_scale: 0.0,
            ref_pixel_x: 0.0,
            ref_pixel_y: 0.0,
            area_width: 0,
            area_height: 0,
            area_start_x: 0,
            area_start_y: 0,
            x_diff: 1.0,
            y_diff: 1.0,
            scaled_width: 0,
            is_super_sampling: false,
            is_result_pass: false,
            calculated_count: 0,
            hit_count: 0,
        }
    }
}

thread_local! {
    static JOB: RefCell<JobContext> = const { RefCell::new(JobContext::new()) };
}

/// JobContext を可変で借りて処理を行う
fn with_job<R>(f: impl FnOnce(&mut JobContext) -> R) -> R {
    JOB.with(|job| f(&mut job.borrow_mut()))
}

/// Vec を最低 len 要素まで伸ばす。既に足りている場合は縮めない (job をまたいだ再利用のため)
fn ensure_len<T: Clone + Default>(v: &mut Vec<T>, len: usize) {
    if v.len() < len {
        v.resize(len, T::default());
    }
}

/// little-endian の f64 をバイト列から読む
#[inline(always)]
fn read_f64(bytes: &[u8], offset: usize) -> f64 {
    f64::from_le_bytes(bytes[offset..offset + 8].try_into().unwrap())
}

/// little-endian の i32 をバイト列から読む
#[inline(always)]
fn read_i32(bytes: &[u8], offset: usize) -> i32 {
    i32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
}

#[inline(always)]
fn mul_re(a_re: f64, a_im: f64, b_re: f64, b_im: f64) -> f64 {
    a_re * b_re - a_im * b_im
}

#[inline(always)]
fn mul_im(a_re: f64, a_im: f64, b_re: f64, b_im: f64) -> f64 {
    a_re * b_im + a_im * b_re
}

#[inline(always)]
fn n_norm(re: f64, im: f64) -> f64 {
    re * re + im * im
}

/// 入力バッファを確保する。このあと `xn_ptr` などでポインタを取得して JS 側からコピーする。
///
/// `area_pixels` に 0 を渡すと iterations キャッシュを確保しない (supersampling 時に使う)。
#[wasm_bindgen]
pub fn alloc_job(
    xn_f64_len: u32,
    bla_bytes_len: u32,
    bla_row_offsets_len: u32,
    area_pixels: u32,
    max_scaled_pixels: u32,
) {
    with_job(|job| {
        ensure_len(&mut job.xn, xn_f64_len as usize);
        ensure_len(&mut job.bla_bytes, bla_bytes_len as usize);
        ensure_len(&mut job.bla_row_offsets, bla_row_offsets_len as usize);
        ensure_len(&mut job.iterations, area_pixels as usize);
        ensure_len(&mut job.scaled_iterations, max_scaled_pixels as usize);
    });
}

#[wasm_bindgen]
pub fn xn_ptr() -> *mut f64 {
    with_job(|job| job.xn.as_mut_ptr())
}

#[wasm_bindgen]
pub fn bla_bytes_ptr() -> *mut u8 {
    with_job(|job| job.bla_bytes.as_mut_ptr())
}

#[wasm_bindgen]
pub fn bla_row_offsets_ptr() -> *mut i32 {
    with_job(|job| job.bla_row_offsets.as_mut_ptr())
}

#[wasm_bindgen]
pub fn scaled_iterations_ptr() -> *mut u32 {
    with_job(|job| job.scaled_iterations.as_mut_ptr())
}

/// job 全体のパラメータを確定する。iterations キャッシュはここで 0 クリアされる。
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn begin_iteration_job(
    max_iteration: u32,
    max_ref_iteration: u32,
    bla_rows: u32,
    start_bla_index: u32,
    delta_c_scale: f64,
    ref_pixel_x: f64,
    ref_pixel_y: f64,
    area_width: u32,
    area_height: u32,
    area_start_x: i32,
    area_start_y: i32,
) {
    with_job(|job| {
        job.max_iteration = max_iteration;
        job.max_ref_iteration = max_ref_iteration;
        job.bla_rows = bla_rows as i32;
        job.start_bla_index = start_bla_index as i32;
        job.delta_c_scale = delta_c_scale;
        job.ref_pixel_x = ref_pixel_x;
        job.ref_pixel_y = ref_pixel_y;
        job.area_width = area_width;
        job.area_height = area_height;
        job.area_start_x = area_start_x;
        job.area_start_y = area_start_y;

        let area_pixels = (area_width as usize) * (area_height as usize);
        if area_pixels <= job.iterations.len() {
            job.iterations[..area_pixels].fill(0);
        }
        job.calculated_count = 0;
    });
}

/// job 開始以降に実際に計算したピクセル数を返す。JS 側の progress 表示に使う。
#[wasm_bindgen]
pub fn get_calculated_count() -> u32 {
    with_job(|job| job.calculated_count)
}

/// 直近の pass で iteration が maxIteration に達したピクセル数を返す。
/// `is_result_pass` を立てた pass でのみ数えている。
#[wasm_bindgen]
pub fn get_hit_count() -> u32 {
    with_job(|job| job.hit_count)
}

/// 1 pass 分のパラメータを設定する。hit count はここでリセットされる。
#[wasm_bindgen]
pub fn begin_pass(
    x_diff: f64,
    y_diff: f64,
    scaled_width: u32,
    is_super_sampling: bool,
    is_result_pass: bool,
) {
    with_job(|job| {
        job.x_diff = x_diff;
        job.y_diff = y_diff;
        job.scaled_width = scaled_width;
        job.is_super_sampling = is_super_sampling;
        job.is_result_pass = is_result_pass;
        job.hit_count = 0;
    });
}

/// 1 ピクセル分の iteration を計算する (perturbation + BLA + rebase)。
///
/// JS 版 `calcIterationAt` の移植。計算順序を変えると結果が変わるのでそのまま維持している。
fn calc_iteration_at(job: &JobContext, pixel_x: f64, pixel_y: f64) -> u32 {
    let max_iteration = job.max_iteration;
    let max_ref_iteration = job.max_ref_iteration;
    let bla_rows = job.bla_rows;
    let start_bla_index = job.start_bla_index;
    let xn_raw = &job.xn;
    let bla_bytes = &job.bla_bytes;
    let row_offsets = &job.bla_row_offsets;

    // Δn
    let mut delta_n_re = 0.0f64;
    let mut delta_n_im = 0.0f64;

    // Δc = (pixel - refPixel) * deltaCScale。cx と W/2 が相殺されるので double だけで出せる
    let delta_c_re = (pixel_x - job.ref_pixel_x) * job.delta_c_scale;
    let delta_c_im = -(pixel_y - job.ref_pixel_y) * job.delta_c_scale;

    let mut iteration: u32 = 0;
    let mut ref_iteration: u32 = 0;

    while iteration < max_iteration {
        let ref_idx2 = (ref_iteration as usize) * 2;
        let x_re = xn_raw[ref_idx2];
        let x_im = xn_raw[ref_idx2 + 1];
        let z_re = x_re + delta_n_re;
        let z_im = x_im + delta_n_im;
        let z_norm = n_norm(z_re, z_im);
        if z_norm > BAILOUT_RADIUS {
            break;
        }

        // rebase
        // https://fractalforums.org/fractal-mathematics-and-new-theories/28/another-solution-to-perturbation-glitches/4360
        let dz_norm = n_norm(delta_n_re, delta_n_im);
        let mut cur_x_re = x_re;
        let mut cur_x_im = x_im;
        if z_norm < dz_norm || ref_iteration == max_ref_iteration {
            delta_n_re = z_re;
            delta_n_im = z_im;
            ref_iteration = 0;
            cur_x_re = xn_raw[0];
            cur_x_im = xn_raw[1];
        }

        // BLA
        // refIteration === (jIdx << d) + 1 と |dz| < r を満たす、最大の l を持つデータを探す。
        // 前者は「refM1 の下位 d bit が 0」と等価なので、d の上限は refM1 の trailing zeros 数。
        // |dz| < r は sqrt を省くため dzNorm < r² で判定する (encode 時に r² を書き込んでいる)
        let mut bla_row_idx: i32 = -1;
        let mut bla_column_idx: i32 = -1;

        if ref_iteration > 0 {
            let ref_m1 = (ref_iteration - 1) as i32;
            // ctz(refM1): refM1 === 0 のときは上限なし (bla_rows 側に任せる)
            let ctz = if ref_m1 == 0 { 32 } else { ref_m1.trailing_zeros() as i32 };
            let max_d = if ctz < bla_rows { ctz } else { bla_rows - 1 };
            let mut d = start_bla_index;
            while d <= max_d {
                let j_idx = ref_m1 >> d;
                let byte_offset =
                    (row_offsets[(d * 2) as usize] as usize) + (j_idx as usize) * ITEM_BYTE_LENGTH;
                let r_sq = read_f64(bla_bytes, byte_offset + 32);

                if dz_norm < r_sq {
                    bla_row_idx = d;
                    bla_column_idx = j_idx;
                } else {
                    break;
                }
                d += 1;
            }
        }

        let has_bla = bla_row_idx >= 0;

        let mut skipped: i32 = 0;
        let mut bla_byte_offset: usize = 0;
        if has_bla {
            bla_byte_offset = (row_offsets[(bla_row_idx * 2) as usize] as usize)
                + (bla_column_idx as usize) * ITEM_BYTE_LENGTH;
            skipped = read_i32(bla_bytes, bla_byte_offset + 40);
        }
        let n = ref_iteration.wrapping_add(skipped as u32);

        if has_bla && n < max_ref_iteration {
            let a_re = read_f64(bla_bytes, bla_byte_offset);
            let a_im = read_f64(bla_bytes, bla_byte_offset + 8);
            let b_re = read_f64(bla_bytes, bla_byte_offset + 16);
            let b_im = read_f64(bla_bytes, bla_byte_offset + 24);

            let dz_re = mul_re(a_re, a_im, delta_n_re, delta_n_im)
                + mul_re(b_re, b_im, delta_c_re, delta_c_im);
            let dz_im = mul_im(a_re, a_im, delta_n_re, delta_n_im)
                + mul_im(b_re, b_im, delta_c_re, delta_c_im);

            delta_n_re = dz_re;
            delta_n_im = dz_im;

            ref_iteration = ref_iteration.wrapping_add(skipped as u32);
            iteration = iteration.wrapping_add(skipped as u32);
        } else {
            // Δn+1 = 2 * Xn * Δn + Δn^2 + Δ0 を (2 * Xn + Δn) * Δn に展開して計算
            let prev_re = delta_n_re;
            let prev_im = delta_n_im;

            let dzr_t = cur_x_re * 2.0 + prev_re;
            let dzi_t = cur_x_im * 2.0 + prev_im;

            delta_n_re = mul_re(dzr_t, dzi_t, prev_re, prev_im) + delta_c_re;
            delta_n_im = mul_im(dzr_t, dzi_t, prev_re, prev_im) + delta_c_im;

            ref_iteration += 1;
            iteration += 1;
        }
    }

    iteration.min(max_iteration)
}

/// pass 内の scaled_y が [from, to) の範囲を計算する。
///
/// 呼び出し粒度が progress 更新と terminator チェックの粒度になる。
#[wasm_bindgen]
pub fn calc_iteration_band(band_scaled_y_from: u32, band_scaled_y_to: u32) {
    with_job(|job| {
        let x_diff = job.x_diff;
        let y_diff = job.y_diff;
        let scaled_w = job.scaled_width;
        let area_w = job.area_width as f64;
        let start_x = job.area_start_x as f64;
        let start_y = job.area_start_y as f64;
        let is_super_sampling = job.is_super_sampling;
        let is_result_pass = job.is_result_pass;
        let max_iteration = job.max_iteration;

        for scaled_y in band_scaled_y_from..band_scaled_y_to {
            let y = start_y + (scaled_y as f64) * y_diff;

            for scaled_x in 0..scaled_w {
                let x = start_x + (scaled_x as f64) * x_diff;
                let scaled_index = (scaled_x + scaled_y * scaled_w) as usize;

                // supersampling 時は 1 pass しかないので iterations キャッシュを使わない。
                // xDiff = 0.5 のため index が area の範囲に収まらず、そもそも参照できない
                if !is_super_sampling {
                    let index = (x - start_x + (y - start_y) * area_w) as usize;
                    let cached = job.iterations[index];
                    if cached != 0 {
                        job.scaled_iterations[scaled_index] = cached;
                        if is_result_pass && cached == max_iteration {
                            job.hit_count += 1;
                        }
                        continue;
                    }

                    let n = calc_iteration_at(job, x, y);
                    job.calculated_count += 1;
                    job.iterations[index] = n;
                    job.scaled_iterations[scaled_index] = n;
                    if is_result_pass && n == max_iteration {
                        job.hit_count += 1;
                    }
                } else {
                    let n = calc_iteration_at(job, x, y);
                    job.calculated_count += 1;
                    job.scaled_iterations[scaled_index] = n;
                    if is_result_pass && n == max_iteration {
                        job.hit_count += 1;
                    }
                }
            }
        }
    });
}

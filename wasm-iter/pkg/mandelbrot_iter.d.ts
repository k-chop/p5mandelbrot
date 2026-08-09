/* tslint:disable */
/* eslint-disable */

/**
 * 入力バッファを確保する。このあと `xn_ptr` などでポインタを取得して JS 側からコピーする。
 *
 * `area_pixels` に 0 を渡すと iterations キャッシュを確保しない (supersampling 時に使う)。
 */
export function alloc_job(xn_f64_len: number, bla_bytes_len: number, bla_row_offsets_len: number, area_pixels: number, max_scaled_pixels: number): void;

/**
 * job 全体のパラメータを確定する。iterations キャッシュはここで 0 クリアされる。
 */
export function begin_iteration_job(max_iteration: number, max_ref_iteration: number, bla_rows: number, start_bla_index: number, delta_c_scale: number, ref_pixel_x: number, ref_pixel_y: number, area_width: number, area_height: number, area_start_x: number, area_start_y: number): void;

/**
 * 1 pass 分のパラメータを設定する。hit count はここでリセットされる。
 */
export function begin_pass(x_diff: number, y_diff: number, scaled_width: number, is_super_sampling: boolean, is_result_pass: boolean): void;

export function bla_bytes_ptr(): number;

export function bla_row_offsets_ptr(): number;

/**
 * pass 内の scaled_y が [from, to) の範囲を計算する。
 *
 * 呼び出し粒度が progress 更新と terminator チェックの粒度になる。
 */
export function calc_iteration_band(band_scaled_y_from: number, band_scaled_y_to: number): void;

/**
 * job 開始以降に実際に計算したピクセル数を返す。JS 側の progress 表示に使う。
 */
export function get_calculated_count(): number;

/**
 * 直近の pass で iteration が maxIteration に達したピクセル数を返す。
 * `is_result_pass` を立てた pass でのみ数えている。
 */
export function get_hit_count(): number;

export function scaled_iterations_ptr(): number;

export function xn_ptr(): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly alloc_job: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly xn_ptr: () => number;
    readonly bla_bytes_ptr: () => number;
    readonly bla_row_offsets_ptr: () => number;
    readonly scaled_iterations_ptr: () => number;
    readonly get_calculated_count: () => number;
    readonly get_hit_count: () => number;
    readonly begin_pass: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly calc_iteration_band: (a: number, b: number) => void;
    readonly begin_iteration_job: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

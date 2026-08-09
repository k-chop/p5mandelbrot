/* @ts-self-types="./mandelbrot_iter.d.ts" */

/**
 * 入力バッファを確保する。このあと `xn_ptr` などでポインタを取得して JS 側からコピーする。
 *
 * `area_pixels` に 0 を渡すと iterations キャッシュを確保しない (supersampling 時に使う)。
 * @param {number} xn_f64_len
 * @param {number} bla_bytes_len
 * @param {number} bla_row_offsets_len
 * @param {number} area_pixels
 * @param {number} max_scaled_pixels
 */
export function alloc_job(xn_f64_len, bla_bytes_len, bla_row_offsets_len, area_pixels, max_scaled_pixels) {
    wasm.alloc_job(xn_f64_len, bla_bytes_len, bla_row_offsets_len, area_pixels, max_scaled_pixels);
}

/**
 * job 全体のパラメータを確定する。iterations キャッシュはここで 0 クリアされる。
 * @param {number} max_iteration
 * @param {number} max_ref_iteration
 * @param {number} bla_rows
 * @param {number} start_bla_index
 * @param {number} delta_c_scale
 * @param {number} ref_pixel_x
 * @param {number} ref_pixel_y
 * @param {number} area_width
 * @param {number} area_height
 * @param {number} area_start_x
 * @param {number} area_start_y
 */
export function begin_iteration_job(max_iteration, max_ref_iteration, bla_rows, start_bla_index, delta_c_scale, ref_pixel_x, ref_pixel_y, area_width, area_height, area_start_x, area_start_y) {
    wasm.begin_iteration_job(max_iteration, max_ref_iteration, bla_rows, start_bla_index, delta_c_scale, ref_pixel_x, ref_pixel_y, area_width, area_height, area_start_x, area_start_y);
}

/**
 * 1 pass 分のパラメータを設定する。hit count はここでリセットされる。
 * @param {number} x_diff
 * @param {number} y_diff
 * @param {number} scaled_width
 * @param {boolean} is_super_sampling
 * @param {boolean} is_result_pass
 */
export function begin_pass(x_diff, y_diff, scaled_width, is_super_sampling, is_result_pass) {
    wasm.begin_pass(x_diff, y_diff, scaled_width, is_super_sampling, is_result_pass);
}

/**
 * @returns {number}
 */
export function bla_bytes_ptr() {
    const ret = wasm.bla_bytes_ptr();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function bla_row_offsets_ptr() {
    const ret = wasm.bla_row_offsets_ptr();
    return ret >>> 0;
}

/**
 * pass 内の scaled_y が [from, to) の範囲を計算する。
 *
 * 呼び出し粒度が progress 更新と terminator チェックの粒度になる。
 * @param {number} band_scaled_y_from
 * @param {number} band_scaled_y_to
 */
export function calc_iteration_band(band_scaled_y_from, band_scaled_y_to) {
    wasm.calc_iteration_band(band_scaled_y_from, band_scaled_y_to);
}

/**
 * job 開始以降に実際に計算したピクセル数を返す。JS 側の progress 表示に使う。
 * @returns {number}
 */
export function get_calculated_count() {
    const ret = wasm.get_calculated_count();
    return ret >>> 0;
}

/**
 * 直近の pass で iteration が maxIteration に達したピクセル数を返す。
 * `is_result_pass` を立てた pass でのみ数えている。
 * @returns {number}
 */
export function get_hit_count() {
    const ret = wasm.get_hit_count();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function scaled_iterations_ptr() {
    const ret = wasm.scaled_iterations_ptr();
    return ret >>> 0;
}

/**
 * @returns {number}
 */
export function xn_ptr() {
    const ret = wasm.xn_ptr();
    return ret >>> 0;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./mandelbrot_iter_bg.js": import0,
    };
}

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('mandelbrot_iter_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };

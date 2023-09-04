mod utils;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calc_reference_point(max_iter: usize) -> *const f64 {
    let mut refs: Vec<f64> = Vec::with_capacity(max_iter);
    unsafe { refs.set_len(max_iter) }

    refs[0] = 0.0;
    refs[1] = 1.0;
    refs[2] = 2.0;
    refs[3] = 3.0;

    let ptr = refs.as_mut_ptr();

    return ptr;
}

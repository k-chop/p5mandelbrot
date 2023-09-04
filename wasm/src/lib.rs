mod utils;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calc_reference_point(
    center_re_str: String,
    center_im_str: String,
    max_iteration: usize,
) -> *const f64 {
    let mut xn = calc(
        center_re_str.as_str(),
        center_im_str.as_str(),
        max_iteration,
    );

    let ptr = xn.as_mut_ptr();

    return ptr;
}

fn calc(center_re_str: &str, center_im_str: &str, max_iteration: usize) -> Vec<f64> {
    let mut xn: Vec<f64> = Vec::with_capacity(max_iteration * 2);

    let mut z_re: f64 = 0.0;
    let mut z_im: f64 = 0.0;

    let mut n: usize = 0;

    let center_re = center_re_str.parse::<f64>().unwrap();
    let center_im = center_im_str.parse::<f64>().unwrap();

    while n <= max_iteration {
        xn.push(z_re);
        xn.push(z_im);

        let z_re2 = (z_re * z_re - z_im * z_im) + center_re;
        let z_im2 = (z_re * z_im * 2.0) + center_im;

        n += 1;

        z_re = z_re2;
        z_im = z_im2;

        if z_re * z_re + z_im * z_im > 4.0 {
            break;
        }
    }

    unsafe {
        xn.shrink_to_fit();
        xn.set_len(n * 2)
    }

    return xn;
}

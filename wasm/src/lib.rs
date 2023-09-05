mod utils;

use astro_float::ctx::Context;
use astro_float::Consts;
use wasm_bindgen::prelude::*;

use astro_float::expr;
use astro_float::BigFloat;
use astro_float::RoundingMode;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub struct ReferenceOrbit {
    vec: Vec<f64>,
}

#[wasm_bindgen]
impl ReferenceOrbit {
    #[wasm_bindgen(constructor)]
    pub fn new(size: usize) -> Self {
        ReferenceOrbit {
            vec: Vec::with_capacity(size),
        }
    }

    pub fn push(&mut self, re: f64, im: f64) {
        self.vec.push(re);
        self.vec.push(im);
    }

    pub fn shrink(&mut self, size: usize) {
        self.vec.shrink_to_fit();

        unsafe { self.vec.set_len(size) }
    }

    #[wasm_bindgen]
    pub fn ptr(&self) -> *const f64 {
        return self.vec.as_ptr();
    }

    #[wasm_bindgen]
    pub fn len(&self) -> usize {
        return self.vec.len();
    }
}

impl Drop for ReferenceOrbit {
    fn drop(&mut self) {
        println!("Dropping ReferenceOrbit");
    }
}

#[wasm_bindgen]
pub fn calc_reference_point(
    center_re_str: String,
    center_im_str: String,
    max_iteration: usize,
) -> ReferenceOrbit {
    let vec = calc(
        center_re_str.as_str(),
        center_im_str.as_str(),
        max_iteration,
    );

    return vec;
}

fn calc(center_re_str: &str, center_im_str: &str, max_iteration: usize) -> ReferenceOrbit {
    let mut xn: ReferenceOrbit = ReferenceOrbit::new(max_iteration * 2);
    let p = 310;
    let rm = RoundingMode::FromZero;
    let mut ctx = Context::new(
        p,
        rm,
        Consts::new().expect("Failed to allocate constants cache"),
    );

    let mut z_re: BigFloat = BigFloat::from_f64(0.0, p);
    let mut z_im: BigFloat = BigFloat::from_f64(0.0, p);

    log(center_re_str);
    log(center_im_str);

    let mut n: usize = 0;

    // Radix::DecのBigFloat::parseがぶっ壊れているのでhexにしている
    let center_re = BigFloat::parse(center_re_str, astro_float::Radix::Hex, p, rm);
    let center_im = BigFloat::parse(center_im_str, astro_float::Radix::Hex, p, rm);

    let bailout = BigFloat::from_f64(4.0, p);

    while n <= max_iteration {
        xn.push(
            z_re.to_string().parse::<f64>().unwrap(),
            z_im.to_string().parse::<f64>().unwrap(),
        );

        let z_re2 = expr!(((z_re * z_re) - (z_im * z_im)) + center_re, &mut ctx);
        let z_im2 = expr!(((z_re * z_im) * 2.0) + center_im, &mut ctx);

        n += 1;

        z_re = z_re2;
        z_im = z_im2;

        let check = expr!(z_re * z_re + z_im * z_im, &mut ctx);

        if check.cmp(&bailout).unwrap() > 0 {
            break;
        }
    }

    xn.shrink(n * 2);

    return xn;
}

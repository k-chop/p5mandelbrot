mod utils;

use std::ops::{Add, Sub};

use wasm_bindgen::prelude::*;

use dashu_float::DBig;
use dashu_float::{round::mode::HalfAway, Context};

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
    let ctx = Context::<HalfAway>::new(310);

    let mut z_re = DBig::from_str_native("0.0").unwrap();
    let mut z_im = DBig::from_str_native("0.0").unwrap();

    let mut n: usize = 0;

    // Radix::DecのBigFloat::parseがぶっ壊れているのでhexにしている
    let center_re = DBig::from_str_native(center_re_str).unwrap();
    let center_im = DBig::from_str_native(center_im_str).unwrap();

    let two = DBig::from_str_native("2.0").unwrap();
    let bailout = DBig::from_str_native("4.0").unwrap();

    while n <= max_iteration {
        xn.push(z_re.to_f64().value(), z_im.to_f64().value());

        let z_re2 = z_re
            .square()
            .sub(z_im.square())
            .add(&center_re)
            .with_precision(310)
            .value();
        let z_im2 = ctx
            .mul(
                &ctx.mul(&z_re.repr(), &z_im.repr()).value().repr(),
                &two.repr(),
            )
            .value()
            .add(&center_im);

        n += 1;

        z_re = z_re2;
        z_im = z_im2;

        let check = z_re.square().add(z_im.square());

        if check.gt(&bailout) {
            break;
        }
    }

    xn.shrink(n * 2);

    return xn;
}

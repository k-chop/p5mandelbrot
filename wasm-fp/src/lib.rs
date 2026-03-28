pub mod complex;
pub mod fixed;

use complex::ComplexFixed;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize)]
pub struct CalculationRequest {
    pub r#type: String,
    pub x: String,
    pub y: String,
    pub max_iter: u32,
}

/// Reference orbit を計算し、各反復の (re, im) を f64 で返す。
/// 戻り値: [re0, im0, re1, im1, ...] (長さ = (反復回数+1) × 2 以下)
/// z0 = (0,0) から始まり、記録してから反復する（JS版calcRefOrbitと同じ順序）。
pub fn perform_calculation(req: CalculationRequest) -> Vec<f64> {
    let c = ComplexFixed::parse(&req.x, &req.y);

    let mut z = ComplexFixed::ZERO;
    let mut result = Vec::with_capacity((req.max_iter as usize + 1) * 2);

    for _ in 0..=req.max_iter {
        // re², im² を norm_squared チェックと z² + c の両方で使い回す
        let re2 = z.re.square();
        let im2 = z.im.square();

        if re2.add(&im2).ge_integer(4) {
            break;
        }

        result.push(z.re.to_f64());
        result.push(z.im.to_f64());

        let re_im = z.re.mul(&z.im);
        z = ComplexFixed::new(
            re2.sub(&im2).add(&c.re),
            re_im.double().add(&c.im),
        );
    }

    result
}

/// JS から呼ぶエントリポイント。
/// 入力: `{ type, x, y, max_iter }` オブジェクト
/// 出力: `Float64Array` — `[re0, im0, re1, im1, ...]`
#[wasm_bindgen]
pub fn calculate(req: JsValue) -> Vec<f64> {
    let req: CalculationRequest =
        serde_wasm_bindgen::from_value(req).expect("invalid CalculationRequest");
    perform_calculation(req)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculation_origin() {
        // c = 0, z stays at 0 forever
        // z0=(0,0) から記録するので max_iter+1 エントリ
        let req = CalculationRequest {
            r#type: "reference_orbit".into(),
            x: "0".into(),
            y: "0".into(),
            max_iter: 10,
        };
        let result = perform_calculation(req);
        assert_eq!(result.len(), 22); // 11 entries × 2
        assert!(result.iter().all(|&v| v == 0.0));
    }

    #[test]
    fn calculation_escapes() {
        // c = 2: z0=0, z1=2 (|z1|²=4 >= 4 → escape)
        // z0 のみ記録される
        let req = CalculationRequest {
            r#type: "reference_orbit".into(),
            x: "2".into(),
            y: "0".into(),
            max_iter: 100,
        };
        let result = perform_calculation(req);
        // z0=(0,0) のみ: [0.0, 0.0]
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], 0.0);
        assert_eq!(result[1], 0.0);
    }

    #[test]
    fn calculation_known_orbit() {
        // c = -1, period-2 orbit: z0=0 → z1=-1 → z2=0 → z3=-1 → z4=0
        // z0 から記録するので 5 エントリ
        let req = CalculationRequest {
            r#type: "reference_orbit".into(),
            x: "-1".into(),
            y: "0".into(),
            max_iter: 4,
        };
        let result = perform_calculation(req);
        assert_eq!(result.len(), 10); // 5 entries × 2
        assert_eq!(result[0], 0.0);   // z0.re
        assert_eq!(result[1], 0.0);   // z0.im
        assert_eq!(result[2], -1.0);  // z1.re
        assert_eq!(result[3], 0.0);   // z1.im
        assert_eq!(result[4], 0.0);   // z2.re
        assert_eq!(result[5], 0.0);   // z2.im
        assert_eq!(result[6], -1.0);  // z3.re
        assert_eq!(result[7], 0.0);   // z3.im
        assert_eq!(result[8], 0.0);   // z4.re
        assert_eq!(result[9], 0.0);   // z4.im
    }

    #[test]
    fn calculation_complex_point() {
        // c = -0.75 + 0.1i — bounded, should not escape in 10 iterations
        // z0 から記録するので 11 エントリ
        let req = CalculationRequest {
            r#type: "reference_orbit".into(),
            x: "-0.75".into(),
            y: "0.1".into(),
            max_iter: 10,
        };
        let result = perform_calculation(req);
        assert_eq!(result.len(), 22); // 11 entries × 2
    }
}

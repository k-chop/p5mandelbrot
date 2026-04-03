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
    /// 使用する上位リム数（省略時は座標の桁数から自動計算）。
    /// 小さいほど高速だが精度が下がる。
    #[serde(default)]
    pub active_limbs: Option<u32>,
}

/// 座標文字列の小数部桁数から必要なリム数を計算する。
/// 必要bit数 = ceil(桁数 × log2(10)) + 余裕 64bit。整数部1リム + 小数部リム数。
fn calc_required_limbs(x: &str, y: &str) -> usize {
    let frac_digits = [x, y]
        .iter()
        .map(|s| {
            let s = s.trim().trim_start_matches('-').trim_start_matches('+');
            match s.find('.') {
                Some(dot) => s.len() - dot - 1,
                None => 0,
            }
        })
        .max()
        .unwrap_or(0);

    // log2(10) ≈ 3.3219
    let frac_bits = (frac_digits as f64 * 3.3219).ceil() as usize + 64;
    let frac_limbs = (frac_bits + 63) / 64;
    // 整数部1リム + 小数部リム、最大32
    (1 + frac_limbs).clamp(2, fixed::LIMBS)
}

/// Reference orbit を計算し、各反復の (re, im) を f64 で返す。
/// 戻り値: [re0, im0, re1, im1, ...] (長さ = (反復回数+1) × 2 以下)
/// z0 = (0,0) から始まり、記録してから反復する（JS版calcRefOrbitと同じ順序）。
pub fn perform_calculation(req: CalculationRequest) -> Vec<f64> {
    let c = ComplexFixed::parse(&req.x, &req.y);
    let limbs = req
        .active_limbs
        .map(|n| (n as usize).clamp(2, fixed::LIMBS))
        .unwrap_or_else(|| calc_required_limbs(&req.x, &req.y));

    let mut z = ComplexFixed::ZERO;
    let mut result = Vec::with_capacity((req.max_iter as usize + 1) * 2);

    for _ in 0..=req.max_iter {
        let re2 = z.re.square_with_limbs(limbs);
        let im2 = z.im.square_with_limbs(limbs);

        if re2.add(&im2).ge_integer(4) {
            break;
        }

        result.push(z.re.to_f64());
        result.push(z.im.to_f64());

        let sum_sq = z.re.add(&z.im).square_with_limbs(limbs);
        let two_re_im = sum_sq.sub(&re2).sub(&im2);
        z = ComplexFixed::new(
            re2.sub(&im2).add(&c.re),
            two_re_im.add(&c.im),
        );
    }

    result
}

/// JS から呼ぶエントリポイント。
/// 入力: `{ type, x, y, max_iter, active_limbs? }` オブジェクト
/// 出力: `Float64Array` — `[re0, im0, re1, im1, ...]`
#[wasm_bindgen]
pub fn calculate(req: JsValue) -> Vec<f64> {
    let req: CalculationRequest =
        serde_wasm_bindgen::from_value(req).expect("invalid CalculationRequest");
    perform_calculation(req)
}

/// 指定リム数でreference orbitを計算する（精度検証用）。
#[cfg(test)]
fn perform_calculation_with_limbs(req: &CalculationRequest, limbs: usize) -> Vec<f64> {
    let req = CalculationRequest {
        r#type: req.r#type.clone(),
        x: req.x.clone(),
        y: req.y.clone(),
        max_iter: req.max_iter,
        active_limbs: Some(limbs as u32),
    };
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
            active_limbs: None,
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
            active_limbs: None,
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
            active_limbs: None,
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
            active_limbs: None,
        };
        let result = perform_calculation(req);
        assert_eq!(result.len(), 22); // 11 entries × 2
    }

    /// 各精度でreference orbitを計算し、フル精度との乖離を報告する。
    /// テストではなくレポート用なので常にpassし、結果をprintlnで出力する。
    /// `cargo test precision_comparison -- --nocapture` で実行。
    #[test]
    fn precision_comparison() {
        // ディープズーム座標（集合内部、escapeしない）
        let test_cases: Vec<(&str, &str, &str, u32)> = vec![
            (
                "主カーディオイド内部 (escapeしない)",
                "-0.75",
                "0.01",
                50000,
            ),
            (
                "period-2 bulb境界近傍 (escapeしない)",
                "-1.25",
                "0.00001",
                50000,
            ),
            (
                "Misiurewicz point近傍 (escapeしない, 高反復)",
                "-0.77568377",
                "0.13646737",
                100000,
            ),
            (
                "ディープズーム座標 62桁",
                "-1.74999841099374081749002483162428393452822344623702767559157566",
                "0.00000000000000000000000000000165821759389886486850149248788819",
                200000,
            ),
        ];

        let limb_counts = [32, 28, 24, 20, 16, 14, 12, 10, 8, 6, 4, 3, 2];

        for (label, x, y, max_iter) in &test_cases {
            println!("\n=== {} (max_iter={}) ===", label, max_iter);

            let req = CalculationRequest {
                r#type: "reference_orbit".into(),
                x: x.to_string(),
                y: y.to_string(),
                max_iter: *max_iter,
                active_limbs: None,
            };

            let full = perform_calculation_with_limbs(&req, 16);
            let full_iters = full.len() / 2;
            println!("Full precision (16 limbs): {} iterations", full_iters);

            for &limbs in &limb_counts[1..] {
                let reduced = perform_calculation_with_limbs(&req, limbs);
                let reduced_iters = reduced.len() / 2;

                // f64が一致する最後の反復を探す
                let common = full_iters.min(reduced_iters);
                let mut first_diverge: Option<usize> = None;
                let mut max_rel_err: f64 = 0.0;

                for i in 0..common {
                    let re_full = full[i * 2];
                    let im_full = full[i * 2 + 1];
                    let re_red = reduced[i * 2];
                    let im_red = reduced[i * 2 + 1];

                    let re_err = if re_full != 0.0 {
                        ((re_full - re_red) / re_full).abs()
                    } else if re_red != 0.0 {
                        f64::INFINITY
                    } else {
                        0.0
                    };
                    let im_err = if im_full != 0.0 {
                        ((im_full - im_red) / im_full).abs()
                    } else if im_red != 0.0 {
                        f64::INFINITY
                    } else {
                        0.0
                    };

                    let err = re_err.max(im_err);
                    max_rel_err = max_rel_err.max(err);

                    // f64のbit表現が異なる最初の反復
                    if first_diverge.is_none()
                        && (re_full.to_bits() != re_red.to_bits()
                            || im_full.to_bits() != im_red.to_bits())
                    {
                        first_diverge = Some(i);
                    }
                }

                let bits = limbs * 64;
                let frac_bits = (limbs - 1) * 64;
                println!(
                    "  {:>2} limbs ({:>4}bit, frac {:>4}bit): iters={:>5}, first_diverge={}, max_rel_err={:.2e}",
                    limbs,
                    bits,
                    frac_bits,
                    reduced_iters,
                    first_diverge.map_or("never".to_string(), |i| format!("iter {:>5}", i)),
                    max_rel_err,
                );
            }
        }
    }
}

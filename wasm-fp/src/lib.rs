pub mod complex;
pub mod fixed;

use complex::ComplexFixed;
use fixed::dispatch_active_limbs;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize)]
pub struct CalculationRequest {
    pub r#type: String,
    pub x: String,
    pub y: String,
    pub max_iter: u32,
    /// 使用する上位リム数。JS側で計算して必ず指定する。
    /// 範囲は [2, fixed::LIMBS]。小さいほど高速だが精度が下がる。
    pub active_limbs: u32,
}

/// Reference orbit を計算し、各反復の (re, im) を f64 で返す。
/// 戻り値: [re0, im0, re1, im1, ...] (長さ = (反復回数+1) × 2 以下)
/// z0 = (0,0) から始まり、記録してから反復する（JS版calcRefOrbitと同じ順序）。
pub fn perform_calculation(req: CalculationRequest) -> Vec<f64> {
    let c = ComplexFixed::parse(&req.x, &req.y);
    let limbs = (req.active_limbs as usize).clamp(2, fixed::LIMBS);
    dispatch_active_limbs!(limbs, orbit_loop, &c, req.max_iter)
}

/// reference orbit のループ本体。
///
/// リム数を const generic にして単相化することで `start = LIMBS - A` が
/// コンパイル時定数になり、使わない下位リムの処理が除去される。
/// 振り分けは [`perform_calculation`] で 1 回だけ行う。
fn orbit_loop<const A: usize>(c: &ComplexFixed, max_iter: u32) -> Vec<f64> {
    let mut z = ComplexFixed::ZERO;
    let mut result = Vec::with_capacity((max_iter as usize + 1) * 2);

    for _ in 0..=max_iter {
        let re2 = z.re.square_const::<A>();
        let im2 = z.im.square_const::<A>();

        if re2.add_const::<A>(&im2).ge_integer(4) {
            break;
        }

        result.push(z.re.to_f64_const::<A>());
        result.push(z.im.to_f64_const::<A>());

        let sum_sq = z.re.add_const::<A>(&z.im).square_const::<A>();
        let two_re_im = sum_sq.sub_const::<A>(&re2).sub_const::<A>(&im2);
        z = ComplexFixed::new(
            re2.sub_const::<A>(&im2).add_const::<A>(&c.re),
            two_re_im.add_const::<A>(&c.im),
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
        active_limbs: limbs as u32,
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
            active_limbs: fixed::LIMBS as u32,
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
            active_limbs: fixed::LIMBS as u32,
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
            active_limbs: fixed::LIMBS as u32,
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
            active_limbs: fixed::LIMBS as u32,
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
                active_limbs: fixed::LIMBS as u32,
            };

            let full = perform_calculation_with_limbs(&req, fixed::LIMBS);
            let full_iters = full.len() / 2;
            println!("Full precision ({} limbs): {} iterations", fixed::LIMBS, full_iters);

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

    /// f64列のビットパターンからFNV-1a 64bitハッシュを計算する。
    ///
    /// 値ではなくビット表現を見るので1 ulpのズレも検出できる。
    fn fingerprint(values: &[f64]) -> u64 {
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        for v in values {
            for byte in v.to_bits().to_le_bytes() {
                hash ^= byte as u64;
                hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
            }
        }
        hash
    }

    /// reference orbitの出力をビット単位で固定する。
    ///
    /// 多倍長ループの最適化は「結果を変えない」ことが前提なので、その網として置く。
    /// `start = LIMBS - active_limbs` で処理範囲が変わるため、active_limbsを散らして
    /// 各経路を踏ませている。座標はベンチPOIから採った。
    ///
    /// 固定小数点の整数演算は厳密なのでnativeとwasmで結果は一致する
    /// (wasmにu64×u64→u128命令がなくエミュレーションになるだけで、値は変わらない)。
    #[test]
    fn reference_orbit_golden() {
        // (label, x, y, active_limbs, expected_len, expected_hash)
        //
        // 座標はベンチPOIから採ったが、`parse` が指数表記を受け付けないので
        // 平坦な10進表記のPOIだけを使い、limb数を散らして経路を稼いでいる
        let cases: [(&str, &str, &str, usize, usize, u64); 7] = [
            (
                "heavy-n-light-iter / 32 limbs",
                "0.2701237597337648151468089210872559290330585338404586945480880642375286137466902863822947734726893678732504691531952149442643761738093667891894268910326695338694216593260",
                "0.005009229312393684589400299097118026037794249881626541648326951827106797599030593628796825598542781592179428913547715184471643655974682851388677903558858892738831120008779",
                32,
                100002,
                0x617f_be71_2def_58ee,
            ),
            (
                "near-limit-r / 20 limbs",
                "-1.985431296887969044721988138339037045398752353280122548176356785008878894488002857818709939311012154727312872245691295555857927156116551713491273570391631953112744174284050322871930097072956531371247097550158111955545307507768618388752719145048639818261597001257070993410988006089774692899255182968917497055643378",
                "0.00008094566790713635928731856114890272349977083094141477987325680750771455145183991184099169198273681548096125157108480819602059398983618495749743473569032420823472992148832489802445840829528011749260671881094621472355137545023613891352307304720120504353365736031702902620685818160251849859601866554526858411899763435",
                20,
                39874,
                0x15ad_49fd_a514_5f59,
            ),
            (
                "heavy-n-light-iter / 13 limbs",
                "0.2701237597337648151468089210872559290330585338404586945480880642375286137466902863822947734726893678732504691531952149442643761738093667891894268910326695338694216593260",
                "0.005009229312393684589400299097118026037794249881626541648326951827106797599030593628796825598542781592179428913547715184471643655974682851388677903558858892738831120008779",
                13,
                100002,
                0x617f_be71_2def_58ee,
            ),
            (
                "average / 12 limbs",
                "-0.1676207162349056453900744774333783193005197110324296103021506839670336963944761096283498843437517249662495064340",
                "1.041381743556022807777969631287024604640137412409919918004050409356921295688038523364011670587986007389832633330",
                12,
                100002,
                0xa881_f4d2_fd92_4839,
            ),
            (
                "near-limit-r / 9 limbs",
                "-1.985431296887969044721988138339037045398752353280122548176356785008878894488002857818709939311012154727312872245691295555857927156116551713491273570391631953112744174284050322871930097072956531371247097550158111955545307507768618388752719145048639818261597001257070993410988006089774692899255182968917497055643378",
                "0.00008094566790713635928731856114890272349977083094141477987325680750771455145183991184099169198273681548096125157108480819602059398983618495749743473569032420823472992148832489802445840829528011749260671881094621472355137545023613891352307304720120504353365736031702902620685818160251849859601866554526858411899763435",
                9,
                33464,
                0xc240_4f54_736c_aee4,
            ),
            (
                "spiral-1 / 5 limbs",
                "-1.75877372414934711425534628637",
                "0.0189731857413472618503959717914",
                5,
                36384,
                0x2ff9_aeec_b969_a841,
            ),
            (
                // 精度が最低なので途中でescapeする経路を踏むはず
                "spiral-2 / 2 limbs",
                "0.44355403336204611582297533053673447703",
                "0.37223875916880398875574744516183097028",
                2,
                7544,
                0x1bab_157a_aee9_c896,
            ),
        ];

        const MAX_ITER: u32 = 50000;

        let actual: Vec<(usize, u64)> = cases
            .iter()
            .map(|(_, x, y, limbs, _, _)| {
                let req = CalculationRequest {
                    r#type: "reference_orbit".into(),
                    x: (*x).into(),
                    y: (*y).into(),
                    max_iter: MAX_ITER,
                    active_limbs: *limbs as u32,
                };
                let result = perform_calculation(req);
                (result.len(), fingerprint(&result))
            })
            .collect();

        // 全件出してから検証する。goldenを作り直すときはこの出力を貼る
        for ((label, ..), (len, hash)) in cases.iter().zip(&actual) {
            println!("{label}: len={len} hash=0x{hash:016x}");
        }

        for ((label, .., expected_len, expected_hash), (len, hash)) in cases.iter().zip(&actual) {
            assert_eq!(len, expected_len, "{label}: 出力長が変わった");
            assert_eq!(hash, expected_hash, "{label}: 出力がビット単位で変わった");
        }
    }
}

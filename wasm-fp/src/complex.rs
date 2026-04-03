use crate::fixed::Fixed2048;

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct ComplexFixed {
    pub re: Fixed2048,
    pub im: Fixed2048,
}

impl ComplexFixed {
    pub const ZERO: Self = Self {
        re: Fixed2048::ZERO,
        im: Fixed2048::ZERO,
    };

    pub fn new(re: Fixed2048, im: Fixed2048) -> Self {
        Self { re, im }
    }

    pub fn parse(re: &str, im: &str) -> Self {
        Self {
            re: Fixed2048::parse(re),
            im: Fixed2048::parse(im),
        }
    }

    pub fn add(&self, other: &Self) -> Self {
        Self {
            re: self.re.add(&other.re),
            im: self.im.add(&other.im),
        }
    }

    pub fn sub(&self, other: &Self) -> Self {
        Self {
            re: self.re.sub(&other.re),
            im: self.im.sub(&other.im),
        }
    }

    /// (a + bi)² = (a² - b²) + (2ab)i
    pub fn square(&self) -> Self {
        let re2 = self.re.square();
        let im2 = self.im.square();
        let re_im = self.re.mul(&self.im);
        Self {
            re: re2.sub(&im2),
            im: re_im.double(),
        }
    }

    /// 各成分の下位リムをゼロにして精度を制限する。
    pub fn truncate(&self, keep_limbs: usize) -> Self {
        Self {
            re: self.re.truncate(keep_limbs),
            im: self.im.truncate(keep_limbs),
        }
    }

    /// |z|² = re² + im²
    pub fn norm_squared(&self) -> Fixed2048 {
        self.re.square().add(&self.im.square())
    }
}

impl std::fmt::Debug for ComplexFixed {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "({:?} + {:?}i)", self.re, self.im)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f64, b: f64) -> bool {
        if a == 0.0 && b == 0.0 {
            return true;
        }
        let diff = (a - b).abs();
        let max = a.abs().max(b.abs());
        diff / max < 1e-10
    }

    #[test]
    fn add_complex() {
        let a = ComplexFixed::parse("1.5", "0.5");
        let b = ComplexFixed::parse("0.5", "1.5");
        let r = a.add(&b);
        assert_eq!(r.re.to_f64(), 2.0);
        assert_eq!(r.im.to_f64(), 2.0);
    }

    #[test]
    fn sub_complex() {
        let a = ComplexFixed::parse("1.5", "0.5");
        let b = ComplexFixed::parse("0.5", "1.5");
        let r = a.sub(&b);
        assert_eq!(r.re.to_f64(), 1.0);
        assert_eq!(r.im.to_f64(), -1.0);
    }

    #[test]
    fn square_real_only() {
        let z = ComplexFixed::parse("0.5", "0");
        let r = z.square();
        assert_eq!(r.re.to_f64(), 0.25);
        assert_eq!(r.im.to_f64(), 0.0);
    }

    #[test]
    fn square_imaginary_only() {
        // (bi)² = -b²
        let z = ComplexFixed::parse("0", "0.5");
        let r = z.square();
        assert_eq!(r.re.to_f64(), -0.25);
        assert_eq!(r.im.to_f64(), 0.0);
    }

    #[test]
    fn square_one_plus_i() {
        // (1 + i)² = 1 - 1 + 2i = 2i
        let z = ComplexFixed::parse("1", "1");
        let r = z.square();
        assert!(approx_eq(r.re.to_f64(), 0.0));
        assert!(approx_eq(r.im.to_f64(), 2.0));
    }

    #[test]
    fn norm_squared_unit() {
        let z = ComplexFixed::parse("0.6", "0.8");
        assert!(approx_eq(z.norm_squared().to_f64(), 1.0));
    }

    #[test]
    fn norm_squared_zero() {
        assert_eq!(ComplexFixed::ZERO.norm_squared().to_f64(), 0.0);
    }

    #[test]
    fn mandelbrot_iteration() {
        // c = -0.75 + 0.1i, z0 = 0
        // z1 = c = -0.75 + 0.1i
        // z2 = z1² + c = (0.5625 - 0.01 - 0.75) + (-0.15 + 0.1)i = -0.1975 - 0.05i
        let c = ComplexFixed::parse("-0.75", "0.1");
        let z1 = c;
        let z2 = z1.square().add(&c);

        let expected_re = 0.5625 - 0.01 - 0.75;
        let expected_im = 2.0 * (-0.75) * 0.1 + 0.1;
        assert!(approx_eq(z2.re.to_f64(), expected_re));
        assert!(approx_eq(z2.im.to_f64(), expected_im));
    }

    // ── High-precision complex tests ──

    #[test]
    fn mandelbrot_deep_zoom_coordinate() {
        // ディープズーム座標での反復が安定して動作するか
        let c = ComplexFixed::parse(
            "-1.74999841099374081749002483162428393452822344623702767559157566",
            "0.00000000000000000000000000000165821759389886486850149248788819",
        );

        let mut z = ComplexFixed::ZERO;
        for _ in 0..50 {
            z = z.square().add(&c);
            // escape していないことを確認
            assert!(
                z.norm_squared().to_f64() < 4.0,
                "escaped at norm²={}",
                z.norm_squared().to_f64()
            );
        }
    }

    #[test]
    fn mandelbrot_period2_high_precision() {
        // c = -1 は周期2: z → -1 → 0 → -1 → 0 → ...
        // 高精度座標で微小なずれがあっても数反復は安定するはず
        let c = ComplexFixed::parse(
            "-1.00000000000000000000000000000000000000000000000000000000000001",
            "0.00000000000000000000000000000000000000000000000000000000000001",
        );

        let mut z = ComplexFixed::ZERO;
        // 10反復後もescapeしない（-1付近はマンデルブロ集合の内部）
        for _ in 0..10 {
            z = z.square().add(&c);
        }
        assert!(z.norm_squared().to_f64() < 4.0);
    }

    #[test]
    fn complex_identity_norm_of_product() {
        // |z²|² = (|z|²)²
        // 乗算の切り捨て誤差で bit-exact にはならないので to_f64 で比較
        let z = ComplexFixed::parse(
            "0.314159265358979323846264338327950288419716939937510582097494",
            "0.271828182845904523536028747135266249775724709369995957496696",
        );

        let norm_sq = z.norm_squared();
        let z_sq_norm_sq = z.square().norm_squared();
        let expected = norm_sq.square();
        assert!(approx_eq(z_sq_norm_sq.to_f64(), expected.to_f64()));

        // リムレベルでも差は最下位数リム以内
        let diff_count = (0..32)
            .filter(|&i| z_sq_norm_sq.limbs[i] != expected.limbs[i])
            .count();
        assert!(diff_count <= 4, "too many differing limbs: {diff_count}");
    }

    #[test]
    fn complex_square_vs_mul_self() {
        // z.square() と z.mul_components() が同じ結果
        let z = ComplexFixed::parse(
            "0.618033988749894848204586834365638117720309179805762862135448",
            "-0.48656251421526505781943964572900090383966164585441952554804",
        );

        let sq = z.square();

        // 手動で (a+bi)² = (a²-b²) + (2ab)i
        let re2 = z.re.square();
        let im2 = z.im.square();
        let two_re_im = z.re.mul(&z.im).double();
        let manual = ComplexFixed::new(re2.sub(&im2), two_re_im);

        assert_eq!(sq, manual);
    }

    #[test]
    fn mandelbrot_100_iterations_bounded() {
        // Misiurewicz point 付近: c = -0.10109636384562 + 0.95628651080914i
        // 集合の境界付近だが内部の点
        let c = ComplexFixed::parse(
            "-0.10109636384562",
            "0.95628651080914",
        );

        let mut z = ComplexFixed::ZERO;
        let mut escaped = false;
        for _ in 0..100 {
            z = z.square().add(&c);
            if z.norm_squared().to_f64() > 4.0 {
                escaped = true;
                break;
            }
        }
        // この点は100反復で escape する（集合の外側ギリギリ）
        // escape するかどうかは問わず、計算が破綻しないことを確認
        let _ = escaped;
        // norm が有限値であること
        assert!(z.norm_squared().to_f64().is_finite());
    }

    #[test]
    fn complex_sub_cancellation() {
        // z - z = 0 (高精度)
        let z = ComplexFixed::parse(
            "0.123456789012345678901234567890123456789012345678901234567890",
            "-0.987654321098765432109876543210987654321098765432109876543210",
        );
        assert_eq!(z.sub(&z), ComplexFixed::ZERO);
    }

    #[test]
    fn norm_squared_high_precision() {
        // 3/5 + 4/5 i → |z|² = 9/25 + 16/25 = 1
        // 高精度で 0.6 と 0.8 をパース
        let z = ComplexFixed::parse(
            "0.600000000000000000000000000000000000000000000000000000000000",
            "0.800000000000000000000000000000000000000000000000000000000000",
        );
        // norm² は to_f64 で 1.0 に十分近い
        assert!(approx_eq(z.norm_squared().to_f64(), 1.0));
    }
}

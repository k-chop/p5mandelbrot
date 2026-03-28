use std::cmp::Ordering;
use std::fmt;

/// 1024-bit fixed-point number: 64-bit integer + 960-bit fraction.
///
/// Representation: sign-magnitude, 16 × u64 little-endian limbs.
/// `limbs[15]` = integer part, `limbs[0..15]` = fractional part (960 bits).
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Fixed1024 {
    pub(crate) limbs: [u64; 16],
    pub(crate) negative: bool,
}

impl Fixed1024 {
    pub const ZERO: Self = Self {
        limbs: [0; 16],
        negative: false,
    };

    pub fn new(limbs: [u64; 16], negative: bool) -> Self {
        let mut f = Self { limbs, negative };
        if f.is_zero() {
            f.negative = false;
        }
        f
    }

    pub fn is_zero(&self) -> bool {
        self.limbs.iter().all(|&x| x == 0)
    }

    pub fn negate(&self) -> Self {
        if self.is_zero() {
            *self
        } else {
            Self {
                limbs: self.limbs,
                negative: !self.negative,
            }
        }
    }

    fn cmp_magnitude(&self, other: &Self) -> Ordering {
        for i in (0..16).rev() {
            match self.limbs[i].cmp(&other.limbs[i]) {
                Ordering::Equal => continue,
                ord => return ord,
            }
        }
        Ordering::Equal
    }

    fn add_limbs(a: &[u64; 16], b: &[u64; 16]) -> [u64; 16] {
        let mut result = [0u64; 16];
        let mut carry = 0u64;
        for i in 0..16 {
            let (s1, c1) = a[i].overflowing_add(b[i]);
            let (s2, c2) = s1.overflowing_add(carry);
            result[i] = s2;
            carry = c1 as u64 + c2 as u64;
        }
        result
    }

    fn sub_limbs(a: &[u64; 16], b: &[u64; 16]) -> [u64; 16] {
        let mut result = [0u64; 16];
        let mut borrow = 0u64;
        for i in 0..16 {
            let (s1, b1) = a[i].overflowing_sub(b[i]);
            let (s2, b2) = s1.overflowing_sub(borrow);
            result[i] = s2;
            borrow = b1 as u64 + b2 as u64;
        }
        result
    }

    pub fn add(&self, other: &Self) -> Self {
        if self.negative == other.negative {
            let limbs = Self::add_limbs(&self.limbs, &other.limbs);
            Self::new(limbs, self.negative)
        } else {
            match self.cmp_magnitude(other) {
                Ordering::Greater => {
                    let limbs = Self::sub_limbs(&self.limbs, &other.limbs);
                    Self::new(limbs, self.negative)
                }
                Ordering::Less => {
                    let limbs = Self::sub_limbs(&other.limbs, &self.limbs);
                    Self::new(limbs, other.negative)
                }
                Ordering::Equal => Self::ZERO,
            }
        }
    }

    pub fn sub(&self, other: &Self) -> Self {
        self.add(&other.negate())
    }

    pub fn mul(&self, other: &Self) -> Self {
        self.mul_with_limbs(other, 16)
    }

    /// 上位 `active_limbs` 個のリムのみ使って乗算する。
    /// 下位リムの計算をスキップして高速化する。
    pub fn mul_with_limbs(&self, other: &Self, active_limbs: usize) -> Self {
        let start = 16 - active_limbs.min(16);
        let mut product = [0u64; 32];
        for i in start..16 {
            let mut carry = 0u128;
            for j in start..16 {
                let p = (self.limbs[i] as u128) * (other.limbs[j] as u128)
                    + product[i + j] as u128
                    + carry;
                product[i + j] = p as u64;
                carry = p >> 64;
            }
            let mut k = i + 16;
            let mut c = carry as u64;
            while c > 0 && k < 32 {
                let (s, overflow) = product[k].overflowing_add(c);
                product[k] = s;
                c = overflow as u64;
                k += 1;
            }
        }
        let mut limbs = [0u64; 16];
        for i in 0..16 {
            limbs[i] = product[i + 15];
        }
        Self::new(limbs, self.negative != other.negative)
    }

    pub fn square(&self) -> Self {
        self.square_with_limbs(16)
    }

    /// 上位 `active_limbs` 個のリムのみ使って自乗する。
    /// a[i]*a[j] == a[j]*a[i] の対称性を利用し、
    /// 対角以外の積を1回だけ計算して2倍することで乗算回数を約47%削減する。
    pub fn square_with_limbs(&self, active_limbs: usize) -> Self {
        let start = 16 - active_limbs.min(16);
        let mut product = [0u64; 32];

        // Off-diagonal: i < j の組み合わせのみ計算
        for i in start..16 {
            let mut carry = 0u128;
            for j in (i + 1)..16 {
                let p = (self.limbs[i] as u128) * (self.limbs[j] as u128)
                    + product[i + j] as u128
                    + carry;
                product[i + j] = p as u64;
                carry = p >> 64;
            }
            // carry を上位に伝播
            let mut k = i + 16;
            let mut c = carry as u64;
            while c > 0 && k < 32 {
                let (s, overflow) = product[k].overflowing_add(c);
                product[k] = s;
                c = overflow as u64;
                k += 1;
            }
        }

        // off-diagonal 部分を2倍（左シフト1）
        let shift_start = start * 2;
        let mut shift_carry = 0u64;
        for i in shift_start..32 {
            let new_carry = product[i] >> 63;
            product[i] = (product[i] << 1) | shift_carry;
            shift_carry = new_carry;
        }

        // Diagonal: a[i]*a[i] を加算
        for i in start..16 {
            let p = (self.limbs[i] as u128) * (self.limbs[i] as u128);
            let lo = p as u64;
            let hi = (p >> 64) as u64;
            let idx = i * 2;

            let (s1, c1) = product[idx].overflowing_add(lo);
            product[idx] = s1;
            let (s2, c2) = product[idx + 1].overflowing_add(hi);
            let (s3, c3) = s2.overflowing_add(c1 as u64);
            product[idx + 1] = s3;

            let mut c = c2 as u64 + c3 as u64;
            let mut k = idx + 2;
            while c > 0 && k < 32 {
                let (s, overflow) = product[k].overflowing_add(c);
                product[k] = s;
                c = overflow as u64;
                k += 1;
            }
        }

        let mut limbs = [0u64; 16];
        for i in 0..16 {
            limbs[i] = product[i + 15];
        }
        // 自乗は常に非負
        Self::new(limbs, false)
    }

    /// 下位リムをゼロにして精度を制限する。
    /// `keep_limbs` 個の上位リム（limbs[16-keep_limbs..16]）のみ残す。
    pub fn truncate(&self, keep_limbs: usize) -> Self {
        let mut limbs = [0u64; 16];
        let start = 16 - keep_limbs.min(16);
        for i in start..16 {
            limbs[i] = self.limbs[i];
        }
        Self {
            limbs,
            negative: self.negative,
        }
    }

    /// 右1bitシフト（2で割る）。符号は保持する。
    pub fn half(&self) -> Self {
        let mut limbs = [0u64; 16];
        for i in 0..16 {
            limbs[i] = self.limbs[i] >> 1;
            if i + 1 < 16 {
                limbs[i] |= self.limbs[i + 1] << 63;
            }
        }
        Self {
            limbs,
            negative: self.negative,
        }
    }

    pub fn double(&self) -> Self {
        let mut limbs = [0u64; 16];
        let mut carry = 0u64;
        for i in 0..16 {
            limbs[i] = (self.limbs[i] << 1) | carry;
            carry = self.limbs[i] >> 63;
        }
        Self {
            limbs,
            negative: self.negative,
        }
    }

    /// self >= threshold (非負の整数) を整数部リムのみで判定する。
    /// norm_squared の bailout チェックなど、to_f64 変換を避けて高速に比較したい場合に使う。
    pub fn ge_integer(&self, threshold: u64) -> bool {
        !self.negative && self.limbs[15] >= threshold
    }

    pub fn to_f64(&self) -> f64 {
        let mut top = 15;
        while top > 0 && self.limbs[top] == 0 {
            top -= 1;
        }
        if self.limbs[top] == 0 {
            return 0.0;
        }

        let (val, exp) = if top > 0 {
            let v = ((self.limbs[top] as u128) << 64) | (self.limbs[top - 1] as u128);
            (v, (top as i32 - 16) * 64)
        } else {
            (self.limbs[0] as u128, -960)
        };

        let f = val as f64 * 2.0_f64.powi(exp);
        if self.negative {
            -f
        } else {
            f
        }
    }

    pub fn parse(s: &str) -> Self {
        let s = s.trim();
        if s.is_empty() || s == "0" || s == "-0" || s == "+0" {
            return Self::ZERO;
        }

        let (negative, s) = if let Some(rest) = s.strip_prefix('-') {
            (true, rest)
        } else if let Some(rest) = s.strip_prefix('+') {
            (false, rest)
        } else {
            (false, s)
        };

        let (int_str, frac_str) = match s.find('.') {
            Some(pos) => (&s[..pos], &s[pos + 1..]),
            None => (s, ""),
        };

        let mut limbs = [0u64; 16];

        if !int_str.is_empty() {
            limbs[15] = int_str.parse::<u64>().expect("invalid integer part");
        }

        if !frac_str.is_empty() {
            let mut digits: Vec<u8> = frac_str.bytes().map(|b| b - b'0').collect();

            for bit_idx in 0..960usize {
                let mut carry = 0u8;
                for d in digits.iter_mut().rev() {
                    let val = *d * 2 + carry;
                    *d = val % 10;
                    carry = val / 10;
                }
                if carry > 0 {
                    let limb_idx = 14 - bit_idx / 64;
                    let bit_pos = 63 - bit_idx % 64;
                    limbs[limb_idx] |= 1u64 << bit_pos;
                }
            }
        }

        Self::new(limbs, negative)
    }
}

impl fmt::Debug for Fixed1024 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Fixed1024({:e})", self.to_f64())
    }
}

impl fmt::Display for Fixed1024 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_f64())
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

    // ── Parse tests ──

    #[test]
    fn parse_zero() {
        assert_eq!(Fixed1024::parse("0"), Fixed1024::ZERO);
        assert_eq!(Fixed1024::parse("-0"), Fixed1024::ZERO);
        assert_eq!(Fixed1024::parse("+0"), Fixed1024::ZERO);
    }

    #[test]
    fn parse_integer() {
        let one = Fixed1024::parse("1");
        assert_eq!(one.limbs[15], 1);
        assert!(!one.negative);
        for i in 0..15 {
            assert_eq!(one.limbs[i], 0);
        }
    }

    #[test]
    fn parse_negative_integer() {
        let neg = Fixed1024::parse("-2");
        assert_eq!(neg.limbs[15], 2);
        assert!(neg.negative);
    }

    #[test]
    fn parse_half() {
        let half = Fixed1024::parse("0.5");
        assert_eq!(half.limbs[14], 1 << 63);
        assert_eq!(half.limbs[15], 0);
        assert!(!half.negative);
    }

    #[test]
    fn parse_quarter() {
        let q = Fixed1024::parse("0.25");
        assert_eq!(q.limbs[14], 1 << 62);
    }

    #[test]
    fn parse_three_quarters() {
        let v = Fixed1024::parse("0.75");
        assert_eq!(v.limbs[14], 3 << 62);
    }

    #[test]
    fn parse_one_point_five() {
        let v = Fixed1024::parse("1.5");
        assert_eq!(v.limbs[15], 1);
        assert_eq!(v.limbs[14], 1 << 63);
    }

    #[test]
    fn parse_negative_half() {
        let v = Fixed1024::parse("-0.5");
        assert!(v.negative);
        assert_eq!(v.limbs[14], 1 << 63);
    }

    #[test]
    fn parse_explicit_positive() {
        let v = Fixed1024::parse("+1.0");
        assert!(!v.negative);
        assert_eq!(v.limbs[15], 1);
    }

    #[test]
    fn parse_small_fraction() {
        let v = Fixed1024::parse("0.1");
        let f = v.to_f64();
        assert!(approx_eq(f, 0.1));
    }

    #[test]
    fn parse_with_whitespace() {
        let v = Fixed1024::parse("  1.5  ");
        assert_eq!(v.to_f64(), 1.5);
    }

    #[test]
    fn parse_integer_no_fraction() {
        let v = Fixed1024::parse("3");
        assert_eq!(v.limbs[15], 3);
        assert_eq!(v.to_f64(), 3.0);
    }

    #[test]
    fn parse_long_fraction() {
        let v = Fixed1024::parse("0.333333333333333333333333333333");
        let f = v.to_f64();
        assert!(approx_eq(f, 1.0 / 3.0));
    }

    #[test]
    fn parse_zero_integer_with_fraction() {
        let v = Fixed1024::parse("0.0");
        assert_eq!(v, Fixed1024::ZERO);
    }

    // ── to_f64 tests ──

    #[test]
    fn to_f64_zero() {
        assert_eq!(Fixed1024::ZERO.to_f64(), 0.0);
    }

    #[test]
    fn to_f64_one() {
        assert_eq!(Fixed1024::parse("1").to_f64(), 1.0);
    }

    #[test]
    fn to_f64_negative() {
        assert_eq!(Fixed1024::parse("-1").to_f64(), -1.0);
    }

    #[test]
    fn to_f64_half() {
        assert_eq!(Fixed1024::parse("0.5").to_f64(), 0.5);
    }

    #[test]
    fn to_f64_quarter() {
        assert_eq!(Fixed1024::parse("0.25").to_f64(), 0.25);
    }

    #[test]
    fn to_f64_roundtrip() {
        for val in ["0.125", "0.0625", "1.75", "2.0", "-0.375"] {
            let expected: f64 = val.parse().unwrap();
            let actual = Fixed1024::parse(val).to_f64();
            assert!(
                approx_eq(actual, expected),
                "{val}: expected {expected}, got {actual}"
            );
        }
    }

    // ── Addition tests ──

    #[test]
    fn add_integers() {
        let a = Fixed1024::parse("1");
        let b = Fixed1024::parse("1");
        assert_eq!(a.add(&b).to_f64(), 2.0);
    }

    #[test]
    fn add_fractions() {
        let a = Fixed1024::parse("0.5");
        let b = Fixed1024::parse("0.5");
        assert_eq!(a.add(&b).to_f64(), 1.0);
    }

    #[test]
    fn add_mixed() {
        let a = Fixed1024::parse("1.25");
        let b = Fixed1024::parse("0.75");
        assert_eq!(a.add(&b).to_f64(), 2.0);
    }

    #[test]
    fn add_opposite_signs_cancel() {
        let a = Fixed1024::parse("1");
        let b = Fixed1024::parse("-1");
        assert_eq!(a.add(&b), Fixed1024::ZERO);
    }

    #[test]
    fn add_negative_to_positive() {
        let a = Fixed1024::parse("-0.25");
        let b = Fixed1024::parse("1");
        let r = a.add(&b);
        assert_eq!(r.to_f64(), 0.75);
        assert!(!r.negative);
    }

    #[test]
    fn add_both_negative() {
        let a = Fixed1024::parse("-0.5");
        let b = Fixed1024::parse("-0.5");
        let r = a.add(&b);
        assert_eq!(r.to_f64(), -1.0);
        assert!(r.negative);
    }

    // ── Subtraction tests ──

    #[test]
    fn sub_equal() {
        let a = Fixed1024::parse("1.5");
        assert_eq!(a.sub(&a), Fixed1024::ZERO);
    }

    #[test]
    fn sub_fractions() {
        let a = Fixed1024::parse("0.75");
        let b = Fixed1024::parse("0.25");
        assert_eq!(a.sub(&b).to_f64(), 0.5);
    }

    #[test]
    fn sub_result_negative() {
        let a = Fixed1024::parse("0.25");
        let b = Fixed1024::parse("0.75");
        let r = a.sub(&b);
        assert_eq!(r.to_f64(), -0.5);
        assert!(r.negative);
    }

    // ── Multiplication tests ──

    #[test]
    fn mul_one_by_one() {
        let one = Fixed1024::parse("1");
        assert_eq!(one.mul(&one).to_f64(), 1.0);
    }

    #[test]
    fn mul_half_by_half() {
        let h = Fixed1024::parse("0.5");
        assert_eq!(h.mul(&h).to_f64(), 0.25);
    }

    #[test]
    fn mul_two_by_half() {
        let two = Fixed1024::parse("2");
        let half = Fixed1024::parse("0.5");
        assert_eq!(two.mul(&half).to_f64(), 1.0);
    }

    #[test]
    fn mul_negative_by_negative() {
        let a = Fixed1024::parse("-1");
        assert!(!a.mul(&a).negative);
        assert_eq!(a.mul(&a).to_f64(), 1.0);
    }

    #[test]
    fn mul_negative_by_positive() {
        let a = Fixed1024::parse("-1.5");
        let b = Fixed1024::parse("2");
        let r = a.mul(&b);
        assert!(r.negative);
        assert_eq!(r.to_f64(), -3.0);
    }

    #[test]
    fn mul_by_zero() {
        let a = Fixed1024::parse("1.5");
        let r = a.mul(&Fixed1024::ZERO);
        assert_eq!(r, Fixed1024::ZERO);
        assert!(!r.negative);
    }

    #[test]
    fn mul_fractions() {
        let a = Fixed1024::parse("0.1");
        let b = Fixed1024::parse("0.1");
        assert!(approx_eq(a.mul(&b).to_f64(), 0.01));
    }

    // ── Square tests ──

    #[test]
    fn square_half() {
        assert_eq!(Fixed1024::parse("0.5").square().to_f64(), 0.25);
    }

    #[test]
    fn square_negative() {
        let r = Fixed1024::parse("-1.5").square();
        assert!(!r.negative);
        assert_eq!(r.to_f64(), 2.25);
    }

    // ── Double tests ──

    #[test]
    fn double_half() {
        assert_eq!(Fixed1024::parse("0.5").double().to_f64(), 1.0);
    }

    #[test]
    fn double_one() {
        assert_eq!(Fixed1024::parse("1").double().to_f64(), 2.0);
    }

    #[test]
    fn double_negative() {
        let r = Fixed1024::parse("-0.25").double();
        assert!(r.negative);
        assert_eq!(r.to_f64(), -0.5);
    }

    #[test]
    fn double_zero() {
        assert_eq!(Fixed1024::ZERO.double(), Fixed1024::ZERO);
    }

    // ── Negate tests ──

    #[test]
    fn negate_positive() {
        let a = Fixed1024::parse("1.5");
        let n = a.negate();
        assert!(n.negative);
        assert_eq!(n.to_f64(), -1.5);
    }

    #[test]
    fn negate_zero() {
        let n = Fixed1024::ZERO.negate();
        assert!(!n.negative);
    }

    #[test]
    fn negate_double() {
        let a = Fixed1024::parse("0.5");
        assert_eq!(a.negate().negate(), a);
    }

    // ── Integration tests ──

    #[test]
    fn mandelbrot_single_iteration() {
        // z = 0, c = 0.25 + 0i
        // z' = z^2 + c = 0.25
        let c_re = Fixed1024::parse("0.25");
        let z_re = Fixed1024::ZERO;
        let z_im = Fixed1024::ZERO;

        let re_new = z_re.square().sub(&z_im.square()).add(&c_re);
        let im_new = z_re.mul(&z_im).double();

        assert_eq!(re_new.to_f64(), 0.25);
        assert_eq!(im_new.to_f64(), 0.0);
    }

    #[test]
    fn mandelbrot_two_iterations() {
        // c = -1 + 0i, z0 = 0
        // z1 = 0 + (-1) = -1
        // z2 = (-1)^2 + (-1) = 0
        let c_re = Fixed1024::parse("-1");
        let c_im = Fixed1024::ZERO;
        let mut z_re = Fixed1024::ZERO;
        let mut z_im = Fixed1024::ZERO;

        // iteration 1
        let re2 = z_re.square();
        let im2 = z_im.square();
        let re_im = z_re.mul(&z_im);
        z_re = re2.sub(&im2).add(&c_re);
        z_im = re_im.double().add(&c_im);

        assert_eq!(z_re.to_f64(), -1.0);
        assert_eq!(z_im.to_f64(), 0.0);

        // iteration 2
        let re2 = z_re.square();
        let im2 = z_im.square();
        let re_im = z_re.mul(&z_im);
        z_re = re2.sub(&im2).add(&c_re);
        z_im = re_im.double().add(&c_im);

        assert_eq!(z_re.to_f64(), 0.0);
        assert_eq!(z_im.to_f64(), 0.0);
    }

    #[test]
    fn norm_squared() {
        let re = Fixed1024::parse("0.6");
        let im = Fixed1024::parse("0.8");
        let norm2 = re.square().add(&im.square());
        assert!(approx_eq(norm2.to_f64(), 1.0));
    }

    #[test]
    fn repeated_squaring_convergence() {
        // 0.5^2 = 0.25, 0.25^2 = 0.0625, ...
        let mut v = Fixed1024::parse("0.5");
        let expected = [0.25, 0.0625, 0.00390625];
        for &e in &expected {
            v = v.square();
            assert!(approx_eq(v.to_f64(), e), "expected {e}, got {}", v.to_f64());
        }
    }

    // ── High-precision parse tests ──

    #[test]
    fn parse_one_third_300_digits_bit_pattern() {
        // 1/3 = 0.010101... (binary, repeating period 2)
        // 全ての小数リムが 0x5555555555555555 になるはず
        let s = format!("0.{}", "3".repeat(300));
        let v = Fixed1024::parse(&s);
        for i in 0..15 {
            assert_eq!(
                v.limbs[i], 0x5555555555555555,
                "limb[{i}]: expected 0x5555555555555555, got 0x{:016x}",
                v.limbs[i]
            );
        }
        assert_eq!(v.limbs[15], 0);
    }

    #[test]
    fn parse_two_thirds_300_digits_bit_pattern() {
        // 2/3 = 0.101010... (binary, repeating period 2)
        let s = format!("0.{}", "6".repeat(300));
        let v = Fixed1024::parse(&s);
        for i in 0..15 {
            assert_eq!(
                v.limbs[i], 0xAAAAAAAAAAAAAAAA,
                "limb[{i}]: expected 0xAAAAAAAAAAAAAAAA, got 0x{:016x}",
                v.limbs[i]
            );
        }
    }

    #[test]
    fn parse_60_digit_fraction() {
        let v = Fixed1024::parse(
            "0.123456789012345678901234567890123456789012345678901234567890",
        );
        assert!(approx_eq(v.to_f64(), 0.12345678901234568));
        assert!(!v.is_zero());
        // 下位リムもゼロでないことを確認（精度が保持されている）
        assert_ne!(v.limbs[0], 0);
    }

    #[test]
    fn parse_pi_100_digits() {
        let v = Fixed1024::parse(
            "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679",
        );
        assert!(approx_eq(v.to_f64(), std::f64::consts::PI));
        assert_eq!(v.limbs[15], 3);
    }

    // ── Edge case: carry/borrow propagation ──

    #[test]
    fn add_carry_propagation_all_limbs() {
        // 全小数リムが MAX の値（1.0 - 2^-960）にεを足すと1.0になる
        let mut almost_one_limbs = [0u64; 16];
        for i in 0..15 {
            almost_one_limbs[i] = u64::MAX;
        }
        let almost_one = Fixed1024::new(almost_one_limbs, false);

        let mut epsilon_limbs = [0u64; 16];
        epsilon_limbs[0] = 1;
        let epsilon = Fixed1024::new(epsilon_limbs, false);

        let sum = almost_one.add(&epsilon);
        assert_eq!(sum.limbs[15], 1);
        for i in 0..15 {
            assert_eq!(sum.limbs[i], 0, "limb[{i}] should be 0 after carry");
        }
    }

    #[test]
    fn sub_borrow_propagation_all_limbs() {
        // 1.0 - ε = 全小数リムがMAX
        let one = Fixed1024::parse("1");
        let mut epsilon_limbs = [0u64; 16];
        epsilon_limbs[0] = 1;
        let epsilon = Fixed1024::new(epsilon_limbs, false);

        let result = one.sub(&epsilon);
        assert_eq!(result.limbs[15], 0);
        for i in 0..15 {
            assert_eq!(
                result.limbs[i],
                u64::MAX,
                "limb[{i}]: expected MAX after borrow"
            );
        }
    }

    // ── Edge case: smallest representable value ──

    #[test]
    fn smallest_fraction() {
        // 2^-960: limbs[0] = 1, rest = 0
        let mut limbs = [0u64; 16];
        limbs[0] = 1;
        let v = Fixed1024::new(limbs, false);

        let f = v.to_f64();
        assert!(f > 0.0);
        assert!(f < 1e-288);

        // double it 960 times → should become 1.0
        let mut acc = v;
        for _ in 0..960 {
            acc = acc.double();
        }
        assert_eq!(acc.limbs[15], 1);
        for i in 0..15 {
            assert_eq!(acc.limbs[i], 0);
        }
    }

    #[test]
    fn smallest_fraction_square() {
        // 2^-960 の二乗 = 2^-1920 → 表現範囲外 → ゼロに切り捨て
        let mut limbs = [0u64; 16];
        limbs[0] = 1;
        let v = Fixed1024::new(limbs, false);
        assert_eq!(v.square(), Fixed1024::ZERO);
    }

    // ── Edge case: large integer part ──

    #[test]
    fn large_integer_arithmetic() {
        let a = Fixed1024::parse("1000000000");
        let b = Fixed1024::parse("999999999");
        let diff = a.sub(&b);
        assert_eq!(diff.to_f64(), 1.0);
    }

    #[test]
    fn large_integer_mul() {
        let a = Fixed1024::parse("100000");
        let b = Fixed1024::parse("100000");
        assert_eq!(a.mul(&b).to_f64(), 1e10);
    }

    // ── Algebraic identity tests ──
    //
    // 固定小数点乗算は下位15リムを切り捨てるため、
    // 代数的恒等式はbit-exactでは成立しない。
    // 最下位2リム以内の誤差を許容する。

    fn limbs_nearly_equal(a: &Fixed1024, b: &Fixed1024, max_diff_limbs: usize) -> bool {
        if a.negative != b.negative {
            return a.is_zero() && b.is_zero();
        }
        let diff_count = (0..16).filter(|&i| a.limbs[i] != b.limbs[i]).count();
        diff_count <= max_diff_limbs
    }

    #[test]
    fn identity_difference_of_squares() {
        // (a+b)(a-b) ≈ a² - b²
        let a = Fixed1024::parse(
            "0.123456789012345678901234567890123456789012345678901234567890",
        );
        let b = Fixed1024::parse(
            "0.987654321098765432109876543210987654321098765432109876543210",
        );

        let lhs = a.add(&b).mul(&a.sub(&b));
        let rhs = a.square().sub(&b.square());
        assert!(
            limbs_nearly_equal(&lhs, &rhs, 2),
            "identity failed:\nlhs={lhs:?}\nrhs={rhs:?}"
        );
    }

    #[test]
    fn identity_square_of_sum() {
        // (a+b)² ≈ a² + 2ab + b²
        let a = Fixed1024::parse(
            "0.314159265358979323846264338327950288419716939937510582097494",
        );
        let b = Fixed1024::parse(
            "0.271828182845904523536028747135266249775724709369995957496696",
        );

        let lhs = a.add(&b).square();
        let rhs = a.square().add(&a.mul(&b).double()).add(&b.square());
        assert!(
            limbs_nearly_equal(&lhs, &rhs, 2),
            "identity failed:\nlhs={lhs:?}\nrhs={rhs:?}"
        );
    }

    #[test]
    fn identity_difference_of_squares_negative() {
        // 片方が負の値でも恒等式が近似的に成立する
        let a = Fixed1024::parse("-0.75");
        let b = Fixed1024::parse(
            "0.618033988749894848204586834365638117720309179805762862135448",
        );

        let lhs = a.add(&b).mul(&a.sub(&b));
        let rhs = a.square().sub(&b.square());
        assert!(
            limbs_nearly_equal(&lhs, &rhs, 2),
            "identity failed:\nlhs={lhs:?}\nrhs={rhs:?}"
        );
    }

    // ── Catastrophic cancellation ──

    #[test]
    fn sub_nearly_equal_values() {
        // ほぼ等しい値の減算で精度が保たれるか
        let base = "0.123456789012345678901234567890123456789012345678901234567890";
        let a = Fixed1024::parse(base);

        // base + 2^-200 程度の微小な差を作る
        let mut b_limbs = a.limbs;
        b_limbs[11] += 1; // limb[11] は 2^(-4*64) = 2^(-256) 付近
        let b = Fixed1024::new(b_limbs, false);

        let diff = b.sub(&a);
        // 差は limb[11] に 1 が立つだけ
        assert_eq!(diff.limbs[11], 1);
        for i in (0..16).filter(|&i| i != 11) {
            assert_eq!(diff.limbs[i], 0, "limb[{i}] should be 0");
        }
    }

    // ── Multiplication precision ──

    #[test]
    fn mul_high_precision_values() {
        // 高精度の値同士を乗算し、1に掛けても変わらないことを確認
        let a = Fixed1024::parse(
            "0.123456789012345678901234567890123456789012345678901234567890",
        );
        let one = Fixed1024::parse("1");
        assert_eq!(a.mul(&one), a);
    }

    #[test]
    fn mul_commutative() {
        let a = Fixed1024::parse(
            "0.314159265358979323846264338327950288419716939937510582097494",
        );
        let b = Fixed1024::parse(
            "0.271828182845904523536028747135266249775724709369995957496696",
        );
        assert_eq!(a.mul(&b), b.mul(&a));
    }

    #[test]
    fn mul_associative_approx() {
        // 乗算の結合法則: (a*b)*c ≈ a*(b*c)
        // 固定小数点では丸めで完全一致しないが、近い値になるはず
        let a = Fixed1024::parse("0.3");
        let b = Fixed1024::parse("0.7");
        let c = Fixed1024::parse("0.9");
        let lhs = a.mul(&b).mul(&c);
        let rhs = a.mul(&b.mul(&c));
        // 結合法則は丸め誤差で完全一致しない場合があるのでto_f64で比較
        assert!(approx_eq(lhs.to_f64(), rhs.to_f64()));
        // リムレベルでも差は最下位1-2リム程度
        let diff_limbs: usize = (0..16)
            .filter(|&i| lhs.limbs[i] != rhs.limbs[i])
            .count();
        assert!(diff_limbs <= 2, "too many differing limbs: {diff_limbs}");
    }

    // ── Double edge cases ──

    #[test]
    fn double_carry_across_fraction_to_integer() {
        // 0.5 を double → 小数リム最上位ビットが整数リムにキャリー
        let half = Fixed1024::parse("0.5");
        let one = half.double();
        assert_eq!(one.limbs[15], 1);
        assert_eq!(one.limbs[14], 0);
    }

    #[test]
    fn double_all_bits_set() {
        // 全ビット1の小数部をdouble → キャリーが伝播
        // limbs[0] は左シフトで最下位ビットが0になり 0xFFFFFFFFFFFFFFFE
        // limbs[1..14] はキャリーが入って再び 0xFFFFFFFFFFFFFFFF
        // limbs[15] はキャリーで 1
        let mut limbs = [0u64; 16];
        for i in 0..15 {
            limbs[i] = u64::MAX;
        }
        let v = Fixed1024::new(limbs, false);
        let d = v.double();
        assert_eq!(d.limbs[15], 1);
        assert_eq!(d.limbs[0], u64::MAX - 1);
        for i in 1..15 {
            assert_eq!(d.limbs[i], u64::MAX, "limb[{i}]");
        }
    }

    // ── to_f64 edge cases ──

    #[test]
    fn to_f64_only_lowest_limb() {
        // limbs[0]のみに値がある場合 (2^-960 ~ 2^-897 の範囲)
        let mut limbs = [0u64; 16];
        limbs[0] = 1 << 63; // = 2^-897
        let v = Fixed1024::new(limbs, false);
        let f = v.to_f64();
        assert!(f > 0.0);
        // 2^-897 ≈ 1.27e-270
        assert!(approx_eq(f, 2.0_f64.powi(-897)));
    }

    #[test]
    fn to_f64_large_integer() {
        let v = Fixed1024::parse("18446744073709551615"); // u64::MAX
        assert!(approx_eq(v.to_f64(), u64::MAX as f64));
    }
}

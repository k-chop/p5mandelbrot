use std::cmp::Ordering;
use std::fmt;

/// リム数（整数部1 + 小数部31）
pub(crate) const LIMBS: usize = 32;
/// 小数部リム数
const FRAC_LIMBS: usize = LIMBS - 1;
/// 小数部ビット数
const FRAC_BITS: usize = FRAC_LIMBS * 64;
/// 乗算の中間積リム数
pub(crate) const PRODUCT_LIMBS: usize = LIMBS * 2;

/// 2048-bit fixed-point number: 64-bit integer + 1984-bit fraction.
///
/// Representation: sign-magnitude, 32 × u64 little-endian limbs.
/// `limbs[31]` = integer part, `limbs[0..31]` = fractional part (1984 bits).
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Fixed2048 {
    pub(crate) limbs: [u64; LIMBS],
    pub(crate) negative: bool,
}

impl Fixed2048 {
    pub const ZERO: Self = Self {
        limbs: [0; LIMBS],
        negative: false,
    };

    pub fn new(limbs: [u64; LIMBS], negative: bool) -> Self {
        let mut f = Self { limbs, negative };
        if f.is_zero() {
            f.negative = false;
        }
        f
    }

    pub fn is_zero(&self) -> bool {
        self.limbs.iter().all(|&x| x == 0)
    }

    /// `limbs[..start]` が 0 だと分かっている場合のゼロ判定。
    fn is_zero_from(&self, start: usize) -> bool {
        self.limbs[start..].iter().all(|&x| x == 0)
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

    fn cmp_magnitude_ranged(&self, other: &Self, start: usize) -> Ordering {
        for i in (start..LIMBS).rev() {
            match self.limbs[i].cmp(&other.limbs[i]) {
                Ordering::Equal => continue,
                ord => return ord,
            }
        }
        Ordering::Equal
    }

    /// `dst[start..] = a + b`。`dst[..start]` には触らない。
    fn add_limbs_into(dst: &mut [u64; LIMBS], a: &[u64; LIMBS], b: &[u64; LIMBS], start: usize) {
        let mut carry = 0u64;
        for i in start..LIMBS {
            let (s1, c1) = a[i].overflowing_add(b[i]);
            let (s2, c2) = s1.overflowing_add(carry);
            dst[i] = s2;
            carry = c1 as u64 + c2 as u64;
        }
    }

    /// `dst[start..] = a - b` (a >= b 前提)。`dst[..start]` には触らない。
    fn sub_limbs_into(dst: &mut [u64; LIMBS], a: &[u64; LIMBS], b: &[u64; LIMBS], start: usize) {
        let mut borrow = 0u64;
        for i in start..LIMBS {
            let (s1, b1) = a[i].overflowing_sub(b[i]);
            let (s2, b2) = s1.overflowing_sub(borrow);
            dst[i] = s2;
            borrow = b1 as u64 + b2 as u64;
        }
    }

    /// フル精度加算。`add_with_limbs(other, LIMBS)` と等価。
    pub fn add(&self, other: &Self) -> Self {
        self.add_with_limbs(other, LIMBS)
    }

    /// 上位 `active_limbs` 個のリムのみ使って加算する。
    pub fn add_with_limbs(&self, other: &Self, active_limbs: usize) -> Self {
        let mut out = Self::ZERO;
        out.assign_add(self, other, active_limbs);
        out
    }

    /// `self[start..] = a + b`。**`self[..start]` には触らない。**
    ///
    /// 呼び出し側は [`Self::ZERO`] で初期化した値を使い回すこと。
    /// 下位リムは 0 のまま保たれるので、演算のたびに 256 バイトをゼロ埋めする必要がなくなる。
    pub fn assign_add(&mut self, a: &Self, b: &Self, active_limbs: usize) {
        self.assign_add_signed(a, b, b.negative, active_limbs);
    }

    /// `self[start..] = a - b`。制約は [`Self::assign_add`] と同じ。
    pub fn assign_sub(&mut self, a: &Self, b: &Self, active_limbs: usize) {
        self.assign_add_signed(a, b, !b.negative, active_limbs);
    }

    /// `b` の符号を `b_negative` として扱って `self[start..] = a + b` する。
    ///
    /// 減算を `negate()` 経由にすると、符号を反転するためだけに
    /// 32リムまるごとのゼロ判定と 256 バイトのコピーが発生する。
    /// 符号をフラグで渡せばそれが不要になる。
    fn assign_add_signed(&mut self, a: &Self, b: &Self, b_negative: bool, active_limbs: usize) {
        let start = LIMBS - active_limbs.min(LIMBS);
        debug_assert!(
            self.limbs[..start].iter().all(|&x| x == 0),
            "書き込み先の下位リムが0でない。より大きいactive_limbsで使ったバッファを使い回している"
        );
        if a.negative == b_negative {
            Self::add_limbs_into(&mut self.limbs, &a.limbs, &b.limbs, start);
            self.negative = a.negative && !self.is_zero_from(start);
        } else {
            match a.cmp_magnitude_ranged(b, start) {
                Ordering::Greater => {
                    Self::sub_limbs_into(&mut self.limbs, &a.limbs, &b.limbs, start);
                    self.negative = a.negative && !self.is_zero_from(start);
                }
                Ordering::Less => {
                    Self::sub_limbs_into(&mut self.limbs, &b.limbs, &a.limbs, start);
                    self.negative = b_negative && !self.is_zero_from(start);
                }
                Ordering::Equal => {
                    // 値としてはZERO。下位リムはもともと0なので上位だけ潰せば足りる
                    self.limbs[start..].fill(0);
                    self.negative = false;
                }
            }
        }
    }

    /// フル精度減算。`sub_with_limbs(other, LIMBS)` と等価。
    pub fn sub(&self, other: &Self) -> Self {
        self.add(&other.negate())
    }

    /// 上位 `active_limbs` 個のリムのみ使って減算する。
    pub fn sub_with_limbs(&self, other: &Self, active_limbs: usize) -> Self {
        let mut out = Self::ZERO;
        out.assign_sub(self, other, active_limbs);
        out
    }

    /// フル精度乗算。`mul_with_limbs(other, LIMBS)` と等価。
    pub fn mul(&self, other: &Self) -> Self {
        self.mul_with_limbs(other, LIMBS)
    }

    /// 上位 `active_limbs` 個のリムのみ使って乗算する。
    /// 下位リムの計算をスキップして高速化する。
    pub fn mul_with_limbs(&self, other: &Self, active_limbs: usize) -> Self {
        let start = LIMBS - active_limbs.min(LIMBS);
        let mut product = [0u64; PRODUCT_LIMBS];
        for i in start..LIMBS {
            let mut carry = 0u128;
            for j in start..LIMBS {
                let p = (self.limbs[i] as u128) * (other.limbs[j] as u128)
                    + product[i + j] as u128
                    + carry;
                product[i + j] = p as u64;
                carry = p >> 64;
            }
            let mut k = i + LIMBS;
            let mut c = carry as u64;
            while c > 0 && k < PRODUCT_LIMBS {
                let (s, overflow) = product[k].overflowing_add(c);
                product[k] = s;
                c = overflow as u64;
                k += 1;
            }
        }
        let mut limbs = [0u64; LIMBS];
        for i in start..LIMBS {
            limbs[i] = product[i + FRAC_LIMBS];
        }
        Self::new(limbs, self.negative != other.negative)
    }

    /// フル精度自乗。`square_with_limbs(LIMBS)` と等価。
    pub fn square(&self) -> Self {
        self.square_with_limbs(LIMBS)
    }

    /// 上位 `active_limbs` 個のリムのみ使って自乗する。
    /// a[i]*a[j] == a[j]*a[i] の対称性を利用し、
    /// 対角以外の積を1回だけ計算して2倍することで乗算回数を約47%削減する。
    pub fn square_with_limbs(&self, active_limbs: usize) -> Self {
        let mut out = Self::ZERO;
        let mut product = [0u64; PRODUCT_LIMBS];
        out.assign_square(self, &mut product, active_limbs);
        out
    }

    /// `self[start..] = a²`。**`self[..start]` には触らない。**
    ///
    /// `product` は呼び出し側が持つ作業領域で、中身は毎回このメソッドが
    /// 必要な範囲 (`start * 2` 以上) だけ初期化する。
    /// ループの外で 1 個確保して使い回すことで、1 反復あたり 512 バイトの
    /// ゼロ埋めを `start * 2` 個分スキップできる。
    pub(crate) fn assign_square(
        &mut self,
        a: &Self,
        product: &mut [u64; PRODUCT_LIMBS],
        active_limbs: usize,
    ) {
        let start = LIMBS - active_limbs.min(LIMBS);
        debug_assert!(
            self.limbs[..start].iter().all(|&x| x == 0),
            "書き込み先の下位リムが0でない。より大きいactive_limbsで使ったバッファを使い回している"
        );
        // 実際に読み書きするのは start * 2 以上だけ。下位は触らないので消さなくてよい
        product[start * 2..].fill(0);

        // Off-diagonal: i < j の組み合わせのみ計算
        for i in start..LIMBS {
            let mut carry = 0u128;
            for j in (i + 1)..LIMBS {
                let p =
                    (a.limbs[i] as u128) * (a.limbs[j] as u128) + product[i + j] as u128 + carry;
                product[i + j] = p as u64;
                carry = p >> 64;
            }
            // carry を上位に伝播
            let mut k = i + LIMBS;
            let mut c = carry as u64;
            while c > 0 && k < PRODUCT_LIMBS {
                let (s, overflow) = product[k].overflowing_add(c);
                product[k] = s;
                c = overflow as u64;
                k += 1;
            }
        }

        // off-diagonal 部分を2倍（左シフト1）
        let shift_start = start * 2;
        let mut shift_carry = 0u64;
        for i in shift_start..PRODUCT_LIMBS {
            let new_carry = product[i] >> 63;
            product[i] = (product[i] << 1) | shift_carry;
            shift_carry = new_carry;
        }

        // Diagonal: a[i]*a[i] を加算
        for i in start..LIMBS {
            let p = (a.limbs[i] as u128) * (a.limbs[i] as u128);
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
            while c > 0 && k < PRODUCT_LIMBS {
                let (s, overflow) = product[k].overflowing_add(c);
                product[k] = s;
                c = overflow as u64;
                k += 1;
            }
        }

        for i in start..LIMBS {
            self.limbs[i] = product[i + FRAC_LIMBS];
        }
        // 自乗は常に非負
        self.negative = false;
    }

    /// 下位リムをゼロにして精度を制限する。
    /// `keep_limbs` 個の上位リム（limbs[LIMBS-keep_limbs..LIMBS]）のみ残す。
    pub fn truncate(&self, keep_limbs: usize) -> Self {
        let mut limbs = [0u64; LIMBS];
        let start = LIMBS - keep_limbs.min(LIMBS);
        for i in start..LIMBS {
            limbs[i] = self.limbs[i];
        }
        Self {
            limbs,
            negative: self.negative,
        }
    }

    /// 右1bitシフト（2で割る）。符号は保持する。
    pub fn half(&self) -> Self {
        self.half_with_limbs(LIMBS)
    }

    /// 上位 `active_limbs` 個のリムのみ使って右1bitシフトする。
    pub fn half_with_limbs(&self, active_limbs: usize) -> Self {
        let start = LIMBS - active_limbs.min(LIMBS);
        let mut limbs = [0u64; LIMBS];
        for i in start..LIMBS {
            limbs[i] = self.limbs[i] >> 1;
            if i + 1 < LIMBS {
                limbs[i] |= self.limbs[i + 1] << 63;
            }
        }
        Self {
            limbs,
            negative: self.negative,
        }
    }

    pub fn double(&self) -> Self {
        self.double_with_limbs(LIMBS)
    }

    /// 上位 `active_limbs` 個のリムのみ使って左1bitシフトする。
    pub fn double_with_limbs(&self, active_limbs: usize) -> Self {
        let start = LIMBS - active_limbs.min(LIMBS);
        let mut limbs = [0u64; LIMBS];
        let mut carry = 0u64;
        for i in start..LIMBS {
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
        !self.negative && self.limbs[FRAC_LIMBS] >= threshold
    }

    pub fn to_f64(&self) -> f64 {
        let mut top = FRAC_LIMBS;
        while top > 0 && self.limbs[top] == 0 {
            top -= 1;
        }
        if self.limbs[top] == 0 {
            return 0.0;
        }

        let (val, exp) = if top > 0 {
            let v = ((self.limbs[top] as u128) << 64) | (self.limbs[top - 1] as u128);
            (v, (top as i32 - LIMBS as i32) * 64)
        } else {
            (self.limbs[0] as u128, -(FRAC_BITS as i32))
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

        let mut limbs = [0u64; LIMBS];

        if !int_str.is_empty() {
            limbs[FRAC_LIMBS] = int_str.parse::<u64>().expect("invalid integer part");
        }

        if !frac_str.is_empty() {
            let mut digits: Vec<u8> = frac_str.bytes().map(|b| b - b'0').collect();

            for bit_idx in 0..FRAC_BITS {
                let mut carry = 0u8;
                for d in digits.iter_mut().rev() {
                    let val = *d * 2 + carry;
                    *d = val % 10;
                    carry = val / 10;
                }
                if carry > 0 {
                    let limb_idx = (FRAC_LIMBS - 1) - bit_idx / 64;
                    let bit_pos = 63 - bit_idx % 64;
                    limbs[limb_idx] |= 1u64 << bit_pos;
                }
            }
        }

        Self::new(limbs, negative)
    }
}

impl fmt::Debug for Fixed2048 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Fixed2048({:e})", self.to_f64())
    }
}

impl fmt::Display for Fixed2048 {
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
        assert_eq!(Fixed2048::parse("0"), Fixed2048::ZERO);
        assert_eq!(Fixed2048::parse("-0"), Fixed2048::ZERO);
        assert_eq!(Fixed2048::parse("+0"), Fixed2048::ZERO);
    }

    #[test]
    fn parse_integer() {
        let one = Fixed2048::parse("1");
        assert_eq!(one.limbs[31], 1);
        assert!(!one.negative);
        for i in 0..31 {
            assert_eq!(one.limbs[i], 0);
        }
    }

    #[test]
    fn parse_negative_integer() {
        let neg = Fixed2048::parse("-2");
        assert_eq!(neg.limbs[31], 2);
        assert!(neg.negative);
    }

    #[test]
    fn parse_half() {
        let half = Fixed2048::parse("0.5");
        assert_eq!(half.limbs[30], 1 << 63);
        assert_eq!(half.limbs[31], 0);
        assert!(!half.negative);
    }

    #[test]
    fn parse_quarter() {
        let q = Fixed2048::parse("0.25");
        assert_eq!(q.limbs[30], 1 << 62);
    }

    #[test]
    fn parse_three_quarters() {
        let v = Fixed2048::parse("0.75");
        assert_eq!(v.limbs[30], 3 << 62);
    }

    #[test]
    fn parse_one_point_five() {
        let v = Fixed2048::parse("1.5");
        assert_eq!(v.limbs[31], 1);
        assert_eq!(v.limbs[30], 1 << 63);
    }

    #[test]
    fn parse_negative_half() {
        let v = Fixed2048::parse("-0.5");
        assert!(v.negative);
        assert_eq!(v.limbs[30], 1 << 63);
    }

    #[test]
    fn parse_explicit_positive() {
        let v = Fixed2048::parse("+1.0");
        assert!(!v.negative);
        assert_eq!(v.limbs[31], 1);
    }

    #[test]
    fn parse_small_fraction() {
        let v = Fixed2048::parse("0.1");
        let f = v.to_f64();
        assert!(approx_eq(f, 0.1));
    }

    #[test]
    fn parse_with_whitespace() {
        let v = Fixed2048::parse("  1.5  ");
        assert_eq!(v.to_f64(), 1.5);
    }

    #[test]
    fn parse_integer_no_fraction() {
        let v = Fixed2048::parse("3");
        assert_eq!(v.limbs[31], 3);
        assert_eq!(v.to_f64(), 3.0);
    }

    #[test]
    fn parse_long_fraction() {
        let v = Fixed2048::parse("0.333333333333333333333333333333");
        let f = v.to_f64();
        assert!(approx_eq(f, 1.0 / 3.0));
    }

    #[test]
    fn parse_zero_integer_with_fraction() {
        let v = Fixed2048::parse("0.0");
        assert_eq!(v, Fixed2048::ZERO);
    }

    // ── to_f64 tests ──

    #[test]
    fn to_f64_zero() {
        assert_eq!(Fixed2048::ZERO.to_f64(), 0.0);
    }

    #[test]
    fn to_f64_one() {
        assert_eq!(Fixed2048::parse("1").to_f64(), 1.0);
    }

    #[test]
    fn to_f64_negative() {
        assert_eq!(Fixed2048::parse("-1").to_f64(), -1.0);
    }

    #[test]
    fn to_f64_half() {
        assert_eq!(Fixed2048::parse("0.5").to_f64(), 0.5);
    }

    #[test]
    fn to_f64_quarter() {
        assert_eq!(Fixed2048::parse("0.25").to_f64(), 0.25);
    }

    #[test]
    fn to_f64_roundtrip() {
        for val in ["0.125", "0.0625", "1.75", "2.0", "-0.375"] {
            let expected: f64 = val.parse().unwrap();
            let actual = Fixed2048::parse(val).to_f64();
            assert!(
                approx_eq(actual, expected),
                "{val}: expected {expected}, got {actual}"
            );
        }
    }

    // ── Addition tests ──

    #[test]
    fn add_integers() {
        let a = Fixed2048::parse("1");
        let b = Fixed2048::parse("1");
        assert_eq!(a.add(&b).to_f64(), 2.0);
    }

    #[test]
    fn add_fractions() {
        let a = Fixed2048::parse("0.5");
        let b = Fixed2048::parse("0.5");
        assert_eq!(a.add(&b).to_f64(), 1.0);
    }

    #[test]
    fn add_mixed() {
        let a = Fixed2048::parse("1.25");
        let b = Fixed2048::parse("0.75");
        assert_eq!(a.add(&b).to_f64(), 2.0);
    }

    #[test]
    fn add_opposite_signs_cancel() {
        let a = Fixed2048::parse("1");
        let b = Fixed2048::parse("-1");
        assert_eq!(a.add(&b), Fixed2048::ZERO);
    }

    #[test]
    fn add_negative_to_positive() {
        let a = Fixed2048::parse("-0.25");
        let b = Fixed2048::parse("1");
        let r = a.add(&b);
        assert_eq!(r.to_f64(), 0.75);
        assert!(!r.negative);
    }

    #[test]
    fn add_both_negative() {
        let a = Fixed2048::parse("-0.5");
        let b = Fixed2048::parse("-0.5");
        let r = a.add(&b);
        assert_eq!(r.to_f64(), -1.0);
        assert!(r.negative);
    }

    // ── Subtraction tests ──

    #[test]
    fn sub_equal() {
        let a = Fixed2048::parse("1.5");
        assert_eq!(a.sub(&a), Fixed2048::ZERO);
    }

    #[test]
    fn sub_fractions() {
        let a = Fixed2048::parse("0.75");
        let b = Fixed2048::parse("0.25");
        assert_eq!(a.sub(&b).to_f64(), 0.5);
    }

    #[test]
    fn sub_result_negative() {
        let a = Fixed2048::parse("0.25");
        let b = Fixed2048::parse("0.75");
        let r = a.sub(&b);
        assert_eq!(r.to_f64(), -0.5);
        assert!(r.negative);
    }

    // ── Multiplication tests ──

    #[test]
    fn mul_one_by_one() {
        let one = Fixed2048::parse("1");
        assert_eq!(one.mul(&one).to_f64(), 1.0);
    }

    #[test]
    fn mul_half_by_half() {
        let h = Fixed2048::parse("0.5");
        assert_eq!(h.mul(&h).to_f64(), 0.25);
    }

    #[test]
    fn mul_two_by_half() {
        let two = Fixed2048::parse("2");
        let half = Fixed2048::parse("0.5");
        assert_eq!(two.mul(&half).to_f64(), 1.0);
    }

    #[test]
    fn mul_negative_by_negative() {
        let a = Fixed2048::parse("-1");
        assert!(!a.mul(&a).negative);
        assert_eq!(a.mul(&a).to_f64(), 1.0);
    }

    #[test]
    fn mul_negative_by_positive() {
        let a = Fixed2048::parse("-1.5");
        let b = Fixed2048::parse("2");
        let r = a.mul(&b);
        assert!(r.negative);
        assert_eq!(r.to_f64(), -3.0);
    }

    #[test]
    fn mul_by_zero() {
        let a = Fixed2048::parse("1.5");
        let r = a.mul(&Fixed2048::ZERO);
        assert_eq!(r, Fixed2048::ZERO);
        assert!(!r.negative);
    }

    #[test]
    fn mul_fractions() {
        let a = Fixed2048::parse("0.1");
        let b = Fixed2048::parse("0.1");
        assert!(approx_eq(a.mul(&b).to_f64(), 0.01));
    }

    // ── Square tests ──

    #[test]
    fn square_half() {
        assert_eq!(Fixed2048::parse("0.5").square().to_f64(), 0.25);
    }

    #[test]
    fn square_negative() {
        let r = Fixed2048::parse("-1.5").square();
        assert!(!r.negative);
        assert_eq!(r.to_f64(), 2.25);
    }

    // ── Double tests ──

    #[test]
    fn double_half() {
        assert_eq!(Fixed2048::parse("0.5").double().to_f64(), 1.0);
    }

    #[test]
    fn double_one() {
        assert_eq!(Fixed2048::parse("1").double().to_f64(), 2.0);
    }

    // ── Half tests ──

    #[test]
    fn half_one() {
        assert_eq!(Fixed2048::parse("1").half().to_f64(), 0.5);
    }

    #[test]
    fn half_quarter() {
        assert_eq!(Fixed2048::parse("0.25").half().to_f64(), 0.125);
    }

    // ── ge_integer tests ──

    #[test]
    fn ge_integer_basic() {
        let four = Fixed2048::parse("4");
        assert!(four.ge_integer(4));
        assert!(!four.ge_integer(5));

        let neg = Fixed2048::parse("-4");
        assert!(!neg.ge_integer(4));
    }

    // ── High-precision tests ──

    #[test]
    fn deep_zoom_coordinate_parse_and_roundtrip() {
        let x = "-1.74999841099374081749002483162428393452822344623702767559157566";
        let v = Fixed2048::parse(x);
        let f = v.to_f64();
        assert!(
            (f - (-1.75)).abs() < 1e-4,
            "deep zoom coordinate should be near -1.75, got {f}"
        );
    }

    #[test]
    fn mul_with_limbs_matches_full() {
        let a = Fixed2048::parse("0.314159265358979323846264338327950288");
        let b = Fixed2048::parse("-0.271828182845904523536028747135266249");
        let full = a.mul(&b);
        let reduced = a.mul_with_limbs(&b, 16);
        // 上位リムが一致すること
        for i in 20..LIMBS {
            assert_eq!(
                full.limbs[i], reduced.limbs[i],
                "limb {i} differs: full={}, reduced={}",
                full.limbs[i], reduced.limbs[i]
            );
        }
    }

    #[test]
    fn square_with_limbs_matches_full() {
        let a = Fixed2048::parse("0.618033988749894848204586834365638117720309");
        let full = a.square();
        let reduced = a.square_with_limbs(16);
        for i in 20..LIMBS {
            assert_eq!(full.limbs[i], reduced.limbs[i]);
        }
    }

    #[test]
    fn negate_roundtrip() {
        let a = Fixed2048::parse("1.5");
        assert_eq!(a.negate().negate(), a);
        assert_eq!(Fixed2048::ZERO.negate(), Fixed2048::ZERO);
    }

    #[test]
    fn truncate_preserves_upper() {
        let a = Fixed2048::parse("1.5");
        let t = a.truncate(4);
        assert_eq!(t.limbs[31], a.limbs[31]);
        assert_eq!(t.limbs[30], a.limbs[30]);
        assert_eq!(t.limbs[29], a.limbs[29]);
        assert_eq!(t.limbs[28], a.limbs[28]);
        for i in 0..28 {
            assert_eq!(t.limbs[i], 0);
        }
    }

    /// 再現可能な擬似乱数 (xorshift64*)
    fn next_rand(state: &mut u64) -> u64 {
        let mut x = *state;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        *state = x;
        x.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }

    /// active_limbs の範囲の値をランダムに埋めた Fixed2048 を作る。
    ///
    /// 下位リムは 0 のまま。実際の演算結果もそうなっているので入力もそれに合わせる。
    fn random_fixed(state: &mut u64, start: usize) -> Fixed2048 {
        let mut limbs = [0u64; LIMBS];
        for limb in limbs.iter_mut().skip(start) {
            *limb = next_rand(state);
        }
        Fixed2048::new(limbs, next_rand(state) & 1 == 0)
    }

    /// 演算結果の「意味のあるリム」と符号を FNV-1a で畳み込む。
    ///
    /// 下位リム (`0..start`) は捨てられる領域なので見ない。
    /// ここを含めると「下位リムを触らない」系の最適化が結果不変でも落ちてしまう。
    fn fold(hash: &mut u64, v: &Fixed2048, start: usize) {
        for &limb in &v.limbs[start..] {
            for byte in limb.to_le_bytes() {
                *hash ^= byte as u64;
                *hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
            }
        }
        *hash ^= v.negative as u64;
        *hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }

    /// add / sub / mul / square の出力をビット単位で固定する。
    ///
    /// [`super::tests`] の orbit 単位の golden は、参照点が集合内部寄りで誤差増幅が遅く、
    /// 下位リムの差が f64 の仮数に届くまでに数万反復かかるため感度が足りない
    /// (実際 `add_limbs_ranged` の範囲を 1 リムずらしても 7 ケース中 5 ケースが素通りした)。
    /// こちらはプリミティブの出力を直接見るので、1 ビットでも変われば即座に落ちる。
    ///
    /// 多倍長ループの最適化はこのテストを通すことが必須条件。
    #[test]
    fn primitives_golden() {
        // (active_limbs, expected_hash)
        let cases: [(usize, u64); 7] = [
            (2, 0x66b5_d780_eb48_6161),
            (5, 0xdbd8_1b77_ebf9_7f1f),
            (9, 0x30ee_7abb_70f1_0014),
            (12, 0x2e23_c07a_e7cf_cea0),
            (13, 0x73ad_c250_1cae_5d36),
            (20, 0x0562_a977_d048_4077),
            (32, 0x4200_7000_6bf4_e8e9),
        ];

        let actual: Vec<u64> = cases
            .iter()
            .map(|&(active_limbs, _)| {
                let start = LIMBS - active_limbs;
                let mut state = 0x9e37_79b9_7f4a_7c15;
                let mut hash: u64 = 0xcbf2_9ce4_8422_2325;

                for _ in 0..256 {
                    let a = random_fixed(&mut state, start);
                    let b = random_fixed(&mut state, start);

                    fold(&mut hash, &a.add_with_limbs(&b, active_limbs), start);
                    fold(&mut hash, &a.sub_with_limbs(&b, active_limbs), start);
                    fold(&mut hash, &b.sub_with_limbs(&a, active_limbs), start);
                    fold(&mut hash, &a.mul_with_limbs(&b, active_limbs), start);
                    fold(&mut hash, &a.square_with_limbs(active_limbs), start);
                    fold(&mut hash, &b.square_with_limbs(active_limbs), start);

                    // 同符号・異符号の両方を踏ませる (加減算の分岐が変わる)
                    let a_neg = a.negate();
                    fold(&mut hash, &a_neg.add_with_limbs(&b, active_limbs), start);
                    fold(&mut hash, &a_neg.sub_with_limbs(&b, active_limbs), start);

                    // ge_integer は分岐にしか効かないのでboolを畳む
                    hash ^= a.square_with_limbs(active_limbs).ge_integer(4) as u64;
                    hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
                }

                hash
            })
            .collect();

        // 全件出してから検証する。goldenを作り直すときはこの出力を貼る
        for ((active_limbs, _), hash) in cases.iter().zip(&actual) {
            println!("{active_limbs:>2} limbs: 0x{hash:016x}");
        }

        for ((active_limbs, expected), hash) in cases.iter().zip(&actual) {
            assert_eq!(
                hash, expected,
                "{active_limbs} limbs: 出力がビット単位で変わった"
            );
        }
    }
}

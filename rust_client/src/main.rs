use std::time;

use astro_float::ctx::Context;
use astro_float::expr;
use astro_float::BigFloat;
use astro_float::Consts;
use astro_float::Radix;
use astro_float::RoundingMode;
use astro_float::Sign;

use rug::Complex;
use rug::Float;

fn main() {
    astro_float();
    rug();
}

// [42129], (-2.69226756438447737599070014061584203959636738091161847602285848639761123410194460688365591129111950238937825917822133545062030386604782725746476089318437524247309293406301791962041207036106404987068099058831651440152659986060628237914104797847407455754446760853534983339722050909961416883759553792356752 -5.46135643926813444516672013346535484620971607690205358001033589997594833450480672732505512732181480038171452176139640005764563081044395780632149668971743799085475652710048431967203390608118740951107871375438161924651643805015533287275824560609450865881391103017112052644420969451909258233492629801012876e-1), 42129
// Elapsed time: 55 ms
fn rug() {
    let max_iteration = 50000;

    let now = time::Instant::now();

    let center_re_i = Float::parse("-1.408537400223374550983496866638703877765950056271735005951863022034495341910960396585990889377247354329184721916097300836171707822353071514393502045045428218599916142953125").unwrap();
    let center_im_i = Float::parse("0.1360385756605832424157267469300867279712448592945066056412400128811080204929672099044430962984916043688336280108617007855875705619618940154923777370644654005043363385").unwrap();
    let center = Complex::with_val(
        1000,
        (
            Float::with_val(1000, center_re_i),
            Float::with_val(1000, center_im_i),
        ),
    );

    let mut n = 0;

    let mut result: Vec<f64> = Vec::new();

    let mut z = Complex::with_val(1000, (0.0, 0.0));
    let mut z_norm = Float::with_val(1000, 0.0);

    while n <= max_iteration && z_norm < 4.0 {
        z = z.square() + center.clone();

        result.push(z.real().to_f64());
        result.push(z.imag().to_f64());

        z_norm = Float::with_val(53, z.norm_ref());

        n += 1;
    }

    println!("[{}], {}, {}", n, z, result.len() / 2);
    println!("Elapsed time: {} ms", now.elapsed().as_millis());
}

// [42129], -2.692267564384477375990700139235690639682249192220301141837896877354622969852955046474258185650781968202316948634501524813077171264645322593036692723718950230543305860214010564238442012933353125e+0, -5.461356439268134445166720127494617089573953495598505709703251404486120528760309805996442591162859166146263671500961915148334829886093231241298432413559442426346247314225775313008098636401168297e-1, 42129
// Elapsed time: 1139 ms
fn astro_float() {
    let p = 620; // 310 * 2
    let max_iteration = 50000;

    let now = time::Instant::now();

    let cc = Consts::new().expect("Constants cache initialized.");
    let mut ctx = Context::new(p, RoundingMode::ToEven, cc, -10000, 10000);

    let mut z_re = BigFloat::from_f64(0.0, p);
    let mut z_im = BigFloat::from_f64(0.0, p);
    let mut z_norm = BigFloat::from_f64(0.0, p);

    let bailout = BigFloat::from_f64(4.0, p);

    let mut n = 0;

    let mut result: Vec<f64> = Vec::new();

    let center_re = BigFloat::parse("-1.408537400223374550983496866638703877765950056271735005951863022034495341910960396585990889377247354329184721916097300836171707822353071514393502045045428218599916142953125", Radix::Dec, p, RoundingMode::None, &mut ctx.consts());
    let center_im = BigFloat::parse("0.1360385756605832424157267469300867279712448592945066056412400128811080204929672099044430962984916043688336280108617007855875705619618940154923777370644654005043363385", Radix::Dec, p, RoundingMode::None, &mut ctx.consts());

    // let a = expr!(center_re + center_im, &mut ctx);

    while n <= max_iteration && z_norm.cmp(&bailout).unwrap() < 0 {
        let z_re2 = expr!(z_re * z_re, &mut ctx);
        let z_im2 = expr!(z_im * z_im, &mut ctx);
        let z_re_im = expr!(z_re * z_im, &mut ctx);

        z_re = expr!(z_re2 - z_im2 + center_re, &mut ctx);
        z_im = expr!(2.0 * z_re_im + center_im, &mut ctx);

        result.push(to_f64(&z_re, ctx.rounding_mode()));
        result.push(to_f64(&z_im, ctx.rounding_mode()));

        z_norm = expr!(z_re * z_re + z_im * z_im, &mut ctx);

        n += 1;
    }

    println!("[{}], {}, {}, {}", n, z_re, z_im, result.len() / 2);
    println!("Elapsed time: {} ms", now.elapsed().as_millis());
}

// https://github.com/stencillogic/astro-float/issues/11#issuecomment-1998450484
fn to_f64(big_float: &BigFloat, rounding_mode: RoundingMode) -> f64 {
    let mut big_float = big_float.clone();
    big_float.set_precision(64, rounding_mode).unwrap();
    let sign = big_float.sign().unwrap();
    let exponent = big_float.exponent().unwrap();
    let mantissa = big_float.mantissa_digits().unwrap()[0];
    if mantissa == 0 {
        return 0.0;
    }
    let mut exponent: isize = exponent as isize + 0b1111111111;
    let mut ret = 0;
    if exponent >= 0b11111111111 {
        match sign {
            Sign::Pos => f64::INFINITY,
            Sign::Neg => f64::NEG_INFINITY,
        }
    } else if exponent <= 0 {
        let shift = -exponent;
        if shift < 52 {
            ret |= mantissa >> (shift + 12);
            if sign == Sign::Neg {
                ret |= 0x8000000000000000u64;
            }
            f64::from_bits(ret)
        } else {
            0.0
        }
    } else {
        let mantissa = mantissa << 1;
        exponent -= 1;
        if sign == Sign::Neg {
            ret |= 1;
        }
        ret <<= 11;
        ret |= exponent as u64;
        ret <<= 52;
        ret |= mantissa >> 12;
        f64::from_bits(ret)
    }
}

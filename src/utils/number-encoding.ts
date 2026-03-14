/**
 * URL数値パラメータの圧縮エンコーディング
 *
 * toPrecision() の出力文字列を base64url でコンパクトにエンコードする。
 * 形式: [n]<base64url>e<exponent>
 *   - n: 負数の場合のみ付与
 *   - base64url: 有効数字列を BigInt → バイト列 → base64url 変換したもの
 *   - e<exponent>: 指数部（常に付与）
 */

const bigintToBytes = (n: bigint): Uint8Array => {
  if (n === 0n) return new Uint8Array([0]);
  const hex = n.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : "0" + hex;
  const bytes = new Uint8Array(paddedHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(paddedHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const bytesToBigint = (bytes: Uint8Array): bigint => {
  if (bytes.length === 0) return 0n;
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return BigInt("0x" + hex);
};

const toBase64url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64url = (s: string): Uint8Array => {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * toPrecision() の出力文字列をコンパクトにエンコードする
 *
 * 有効数字を整数として BigInt 化し、小数点の位置を指数に吸収する。
 * エンコード形式の指数は「整数の有効数字 × 10^exp = 元の値」となる exp を格納する。
 *
 * 入力例: "-1.408537e-50" → digits=1408537, exp = -50 - 6 = -56
 * 出力例: "nAbCdEfGe-56"
 */
export const encodeNumber = (value: string): string => {
  const match = value.match(/^(-?)([\d.]+)(?:e([+-]?\d+))?$/);
  if (!match) throw new Error(`Invalid number format: ${value}`);

  const negative = match[1] === "-";
  const digitPart = match[2];
  const originalExponent = parseInt(match[3] ?? "0", 10);

  // 小数点以下の桁数を算出し、指数に吸収する
  const dotIndex = digitPart.indexOf(".");
  const fractionalDigits = dotIndex === -1 ? 0 : digitPart.length - dotIndex - 1;
  const storedExponent = originalExponent - fractionalDigits;

  const digits = digitPart.replace(".", "");
  const n = BigInt(digits);
  const bytes = bigintToBytes(n);
  const encoded = toBase64url(bytes);

  const prefix = negative ? "n" : "";
  return `${prefix}${encoded}e${storedExponent}`;
};

/**
 * encodeNumber の逆変換
 *
 * 出力: BigNumber コンストラクタに渡せる10進文字列（例: "1408537e-56"）
 */
export const decodeNumber = (encoded: string): string => {
  const match = encoded.match(/^(n?)([A-Za-z0-9_-]+)e([+-]?\d+)$/);
  if (!match) throw new Error(`Invalid encoded format: ${encoded}`);

  const negative = match[1] === "n";
  const base64Part = match[2];
  const exponent = parseInt(match[3], 10);

  const bytes = fromBase64url(base64Part);
  const n = bytesToBigint(bytes);
  const digits = n.toString();

  // BigNumber が解釈できる形式: <digits>e<exponent>
  const sign = negative ? "-" : "";
  if (exponent === 0) return `${sign}${digits}`;
  return `${sign}${digits}e${exponent}`;
};

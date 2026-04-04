const GCS_BUCKET_URL = "https://storage.googleapis.com/p5mandelbrot-preset-poi";

const ALLOWED_ORIGINS = ["https://p5mandelbrot.pages.dev", "http://localhost:5173"];

/**
 * リクエストのoriginが許可リストに含まれるか判定する
 *
 * Cloudflare Pagesのプレビューデプロイ（*.p5mandelbrot.pages.dev）にも対応する。
 */
const isAllowedOrigin = (origin: string | null): boolean => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.p5mandelbrot\.pages\.dev$/.test(origin);
};

export default {
  /**
   * GCSバケットへのリクエストをプロキシし、CORP/CORSヘッダーを付与する
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    // プリフライトリクエスト
    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": origin!,
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "3600",
        },
      });
    }

    // GETのみ許可
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // GCSにプロキシ
    const gcsUrl = `${GCS_BUCKET_URL}${url.pathname}`;
    const gcsResponse = await fetch(gcsUrl);

    // レスポンスヘッダーにCORP/CORSを付与
    const headers = new Headers(gcsResponse.headers);
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    if (isAllowedOrigin(origin)) {
      headers.set("Access-Control-Allow-Origin", origin!);
    }

    return new Response(gcsResponse.body, {
      status: gcsResponse.status,
      headers,
    });
  },
};

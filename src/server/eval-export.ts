import { readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";

/** eval-exportの基底ディレクトリ */
const EVAL_DIR = join(process.cwd(), "tmp", "eval");

/** エクスポートリクエストのbody型 */
interface EvalExportBody {
  image: string;
  heatmap?: string;
  summary: Record<string, unknown>;
}

/**
 * ./tmp/eval/ 内の既存point-Nディレクトリを走査し、次の番号を返す
 *
 * ディレクトリが存在しない場合は1を返す。
 */
export const getNextPointIndex = (evalDir: string): number => {
  if (!existsSync(evalDir)) {
    return 1;
  }

  const entries = readdirSync(evalDir, { withFileTypes: true });
  let maxIndex = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^point-(\d+)$/);
    if (match) {
      const index = Number(match[1]);
      if (index > maxIndex) maxIndex = index;
    }
  }

  return maxIndex + 1;
};

/**
 * base64 DataURLをBufferにデコードする
 *
 * "data:image/png;base64,..." 形式のDataURLからバイナリデータを抽出する。
 */
export const decodeDataURL = (dataURL: string): Buffer => {
  const commaIndex = dataURL.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid DataURL format");
  }
  return Buffer.from(dataURL.slice(commaIndex + 1), "base64");
};

/**
 * 評価データをファイルシステムに保存する
 *
 * evalDir内に point-{N}/ ディレクトリを作成し、screenshot.png, heatmap.png, summary.json を書き込む。
 * 返り値は採番されたpointIndex。
 */
export const saveEvalData = (
  evalDir: string,
  imageDataURL: string,
  summary: Record<string, unknown>,
  heatmapDataURL?: string,
): number => {
  const pointIndex = getNextPointIndex(evalDir);
  const pointDir = join(evalDir, `point-${pointIndex}`);

  mkdirSync(pointDir, { recursive: true });

  const imageBuffer = decodeDataURL(imageDataURL);
  writeFileSync(join(pointDir, "screenshot.png"), imageBuffer);

  if (heatmapDataURL) {
    const heatmapBuffer = decodeDataURL(heatmapDataURL);
    writeFileSync(join(pointDir, "heatmap.png"), heatmapBuffer);
  }

  writeFileSync(join(pointDir, "summary.json"), JSON.stringify(summary, null, 2));

  return pointIndex;
};

/**
 * eval-export用のHonoアプリを作成する
 *
 * POST /api/eval-export エンドポイントを提供する。
 */
export const createEvalExportApp = (evalDir: string = EVAL_DIR): Hono => {
  const app = new Hono();

  app.use("/api/*", cors());

  app.post("/api/eval-export", async (c) => {
    const body = (await c.req.json()) as EvalExportBody;

    if (!body.image || typeof body.image !== "string") {
      return c.json({ error: "image field is required (DataURL string)" }, 400);
    }

    if (!body.summary || typeof body.summary !== "object") {
      return c.json({ error: "summary field is required (object)" }, 400);
    }

    const pointIndex = saveEvalData(evalDir, body.image, body.summary, body.heatmap);

    console.log(`Eval data saved to point-${pointIndex}`);

    return c.json({ pointIndex });
  });

  return app;
};

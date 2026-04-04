import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Hono } from "hono";
import { decodeDataURL } from "./eval-export";

/** public/preset-poi/ のベースディレクトリ */
const PRESET_DIR = join(process.cwd(), "public", "preset-poi");

/** parameters.json のパス */
const PARAMETERS_PATH = join(PRESET_DIR, "parameters.json");

/** サムネイルディレクトリのパス */
const THUMBNAILS_DIR = join(PRESET_DIR, "thumbnails");

/** プリセットPOIのパラメータ型 */
interface PresetPOIEntry {
  id: string;
  x: string;
  y: string;
  r: string;
  N: number;
  mode: string;
  palette?: string;
}

/**
 * parameters.json を読み込む
 */
const readParameters = (): PresetPOIEntry[] => {
  if (!existsSync(PARAMETERS_PATH)) return [];
  const content = readFileSync(PARAMETERS_PATH, "utf-8");
  return JSON.parse(content);
};

/**
 * parameters.json に書き込む
 */
const writeParameters = (entries: PresetPOIEntry[]) => {
  writeFileSync(PARAMETERS_PATH, JSON.stringify(entries, null, 2) + "\n");
};

/**
 * 次の連番IDを算出する
 *
 * 既存エントリのIDの最大値 + 1 を3桁ゼロ埋めで返す。
 */
const getNextId = (entries: PresetPOIEntry[]): string => {
  let max = 0;
  for (const entry of entries) {
    const num = Number(entry.id);
    if (num > max) max = num;
  }
  return String(max + 1).padStart(3, "0");
};

/** プリセットPOI追加リクエストのbody型 */
interface AddPresetBody {
  x: string;
  y: string;
  r: string;
  N: number;
  mode: string;
  palette?: string;
  thumbnail?: string;
}

/**
 * preset-poi用のルートをHonoアプリに登録する
 *
 * GET /api/preset-poi/:id/thumbnail — サムネイル画像を配信（キャッシュなし）
 * POST /api/preset-poi — プリセットPOIを追加
 * PUT /api/preset-poi/:id/thumbnail — サムネイル画像を更新
 * DELETE /api/preset-poi/:id — プリセットPOIを削除
 */
export const registerPresetPOIRoutes = (app: Hono) => {
  app.get("/api/preset-poi/:id/thumbnail", (c) => {
    const id = c.req.param("id");
    const filePath = join(THUMBNAILS_DIR, `${id}.png`);

    if (!existsSync(filePath)) {
      return c.notFound();
    }

    const buffer = readFileSync(filePath);
    return c.body(buffer, 200, {
      "Content-Type": "image/png",
      "Cache-Control": "no-cache",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
  });
  app.post("/api/preset-poi", async (c) => {
    const body = (await c.req.json()) as AddPresetBody;

    if (!body.x || !body.y || !body.r || !body.N || !body.mode) {
      return c.json({ error: "x, y, r, N, mode are required" }, 400);
    }

    const entries = readParameters();
    const id = getNextId(entries);

    const newEntry: PresetPOIEntry = {
      id,
      x: body.x,
      y: body.y,
      r: body.r,
      N: body.N,
      mode: body.mode,
    };
    if (body.palette) {
      newEntry.palette = body.palette;
    }

    entries.push(newEntry);
    writeParameters(entries);

    if (body.thumbnail) {
      mkdirSync(THUMBNAILS_DIR, { recursive: true });
      const buffer = decodeDataURL(body.thumbnail);
      writeFileSync(join(THUMBNAILS_DIR, `${id}.png`), buffer);
    }

    console.log(`Preset POI added: ${id}`);
    return c.json({ id });
  });

  app.put("/api/preset-poi/:id/thumbnail", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json()) as { thumbnail: string };

    if (!body.thumbnail) {
      return c.json({ error: "thumbnail field is required (DataURL string)" }, 400);
    }

    mkdirSync(THUMBNAILS_DIR, { recursive: true });
    const buffer = decodeDataURL(body.thumbnail);
    writeFileSync(join(THUMBNAILS_DIR, `${id}.png`), buffer);

    console.log(`Preset POI thumbnail updated: ${id}`);
    return c.json({ id });
  });

  app.delete("/api/preset-poi/:id", (c) => {
    const id = c.req.param("id");
    const entries = readParameters();
    const index = entries.findIndex((e) => e.id === id);

    if (index === -1) {
      return c.json({ error: `Preset POI ${id} not found` }, 404);
    }

    entries.splice(index, 1);
    writeParameters(entries);

    const thumbnailPath = join(THUMBNAILS_DIR, `${id}.png`);
    if (existsSync(thumbnailPath)) {
      unlinkSync(thumbnailPath);
    }

    console.log(`Preset POI deleted: ${id}`);
    return c.json({ deleted: id });
  });
};

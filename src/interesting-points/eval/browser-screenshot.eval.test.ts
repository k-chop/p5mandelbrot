import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";

/**
 * ヘッドレス Chrome で任意の URL を開き、一定時間待ってからスクリーンショットを撮る。
 * 実機（ブラウザ）での表示確認をローカルで済ませるためのもの。
 *
 * 環境変数:
 * - IP_SHOT_URL: 開く URL（未設定ならこのテストは何もしない）
 * - IP_SHOT_OUT: 出力 PNG パス（デフォルト tmp/ip-eval/browser.png）
 * - IP_SHOT_WAIT_MS: 読み込み後に待つ時間（デフォルト 40000）
 * - IP_SHOT_CHROME: Chrome バイナリ（デフォルトは playwright が入れた chrome-headless-shell）
 *
 * 実行例: IP_SHOT_URL='http://localhost:5199/p5mandelbrot/?x=...' pnpm vitest run --config vitest.eval.config.ts browser-screenshot
 */

const url = process.env.IP_SHOT_URL;
const out = process.env.IP_SHOT_OUT ?? "tmp/ip-eval/browser.png";
const waitMs = Number(process.env.IP_SHOT_WAIT_MS ?? 40000);
const chrome =
  process.env.IP_SHOT_CHROME ??
  `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const PORT = 9333;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** DevTools Protocol の最小クライアント。id 付きで送り、同じ id の応答を待つ */
const connectCDP = async (wsUrl: string) => {
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("WebSocket error"));
  });
  let nextId = 1;
  const pending = new Map<number, (v: unknown) => void>();
  const events: string[] = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data)) as {
      id?: number;
      result?: unknown;
      method?: string;
      params?: unknown;
    };
    if (msg.id != null) pending.get(msg.id)?.(msg.result);
    else if (msg.method) events.push(`${msg.method} ${JSON.stringify(msg.params)}`);
  };
  return {
    send: <T>(method: string, params: Record<string, unknown> = {}) =>
      new Promise<T>((resolve) => {
        const id = nextId++;
        pending.set(id, (v) => resolve(v as T));
        ws.send(JSON.stringify({ id, method, params }));
      }),
    /** 受信したイベント（console 出力や例外）の一覧 */
    events,
    close: () => ws.close(),
  };
};

it.skipIf(!url)("ブラウザのスクリーンショットを撮る", { timeout: waitMs + 60000 }, async () => {
  const proc = spawn(
    chrome,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1300,950",
      `--remote-debugging-port=${PORT}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  try {
    let targets: Array<{ type: string; webSocketDebuggerUrl: string }> = [];
    for (let i = 0; i < 50 && targets.length === 0; i++) {
      await sleep(200);
      targets = await fetch(`http://localhost:${PORT}/json`)
        .then((r) => r.json())
        .catch(() => []);
    }
    const page = targets.find((t) => t.type === "page");
    if (!page) throw new Error("Chrome の page target が見つかりません");

    const cdp = await connectCDP(page.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url });
    await sleep(waitMs);
    if (process.env.IP_SHOT_JS) {
      // 撮影前にページ内で JS を実行する（ボタンを押してパネルを開く等）。結果はログに出す
      const result = await cdp.send<{ result: { value?: unknown; description?: string } }>(
        "Runtime.evaluate",
        { expression: process.env.IP_SHOT_JS, awaitPromise: true, returnByValue: true },
      );
      writeFileSync(`${out}.js.txt`, JSON.stringify(result.result, null, 2));
      await sleep(Number(process.env.IP_SHOT_JS_WAIT_MS ?? 3000));
    }
    const { data } = await cdp.send<{ data: string }>("Page.captureScreenshot", {
      format: "png",
    });
    writeFileSync(out, Buffer.from(data, "base64"));
    // IP_SHOT_CLIPS="name:x,y,w,h,scale;..." で部分拡大も撮る（マーカーの見え方の確認用）
    for (const spec of (process.env.IP_SHOT_CLIPS ?? "").split(";").filter(Boolean)) {
      const [name, nums] = spec.split(":");
      const [x, y, width, height, scale] = nums.split(",").map(Number);
      const clipped = await cdp.send<{ data: string }>("Page.captureScreenshot", {
        format: "png",
        clip: { x, y, width, height, scale },
      });
      writeFileSync(out.replace(/\.png$/, `-${name}.png`), Buffer.from(clipped.data, "base64"));
    }
    // console 出力と例外を控えておく（表示が出ないときの手がかり）
    writeFileSync(`${out}.console.txt`, cdp.events.join("\n") + "\n");
    cdp.close();
    expect(existsSync(out)).toBe(true);
  } finally {
    proc.kill();
  }
});

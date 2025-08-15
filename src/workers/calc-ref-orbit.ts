/// <reference lib="webworker" />

import {
  encodeBlaTableItems,
  SKIP_BLA_ENTRY_UNTIL_THIS_L,
  type BLATableItem,
} from "@/workers/bla-table-item";
import type { ComplexArrayView } from "@/workers/xn-buffer";
import { encodeComplexArray } from "@/workers/xn-buffer";
import BigNumber from "bignumber.js";
import type { Complex, ComplexArbitrary } from "../math/complex";
import {
  add,
  complex,
  complexArbitary,
  dAdd,
  dNorm,
  dReduce,
  dSquare,
  mul,
  mulN,
  norm,
  pixelToComplexCoordinateComplexArbitrary,
  toComplex,
} from "../math/complex";
import type { BLATableBuffer, RefOrbitWorkerParams, XnBuffer } from "../types";

export type RefOrbitContext = {
  xn: XnBuffer;
  blaTable: BLATableBuffer;
  elapsed: number;
};

export type RefOrbitContextPopulated = {
  xnView: ComplexArrayView;
  blaTable: BLATableItem[][];
};

// FIXME: 手抜き
let websocketServerConnected = false;
let ws: WebSocket | null = null;

function calcRefOrbit(
  center: ComplexArbitrary,
  maxIteration: number,
  terminateChecker: Uint8Array,
  workerIdx: number,
): { xn: Complex[] } {
  // [re_0, im_0, re_1, im_1, ...]
  const xnn = new Float64Array(maxIteration * 2);

  let z = complexArbitary(0.0, 0.0);
  let n = 0;

  const reportTiming = Math.floor(maxIteration / 100);

  while (n <= maxIteration && dNorm(z).lt(4.0)) {
    const { re, im } = toComplex(z);
    xnn[n * 2] = re;
    xnn[n * 2 + 1] = im;

    z = dReduce(dAdd(dSquare(z), center));

    n++;

    if (n % reportTiming === 0) {
      self.postMessage({
        type: "progress",
        progress: n,
      });
    }
    if (terminateChecker[workerIdx] !== 0) break;
  }

  // 中断された
  if (terminateChecker[workerIdx] !== 0) {
    return { xn: [] };
  }

  const xn: Complex[] = [];

  // FIXME: 後ほどFloat64Arrayのまま返すように変更する
  for (let i = 0; i < n; i++) {
    xn.push({ re: xnn[i * 2], im: xnn[i * 2 + 1] });
  }

  return { xn };
}

/**
 * 計算済みのReference OrbitからBLAの係数を計算する
 */
function calcBLACoefficient(ref: Complex[], pixelSpacing: number) {
  // Reference: https://mathr.co.uk/tmp/mandelbla.pdf

  const blaTable: BLATableItem[][] = [];

  const eps = 0.0001;

  blaTable[0] = Array.from({ length: ref.length - 1 });
  for (let i = 1; i < ref.length; i++) {
    const z_m = ref[i];
    const a = mulN(z_m, 2.0);
    const b = complex(1.0, 0.0);

    const absA = Math.sqrt(norm(a));
    const r = Math.max(0, (eps * absA - pixelSpacing) / (absA + 1));
    blaTable[0][i - 1] = { a, b, r, l: 1 };
  }

  const max = Math.floor(Math.log2(ref.length));

  for (let d = 0; d <= max; d++) {
    const nextTableLength = Math.floor((blaTable[d].length + 1) / 2);
    blaTable[d + 1] = Array.from({ length: nextTableLength });

    for (let j = 0; j < nextTableLength; j++) {
      const jx = j * 2;
      const jy = jx + 1;

      if (jy < blaTable[d].length) {
        const x = blaTable[d][jx];
        const y = blaTable[d][jy];

        const a = mul(y.a, x.a);
        const b = add(mul(y.a, x.b), y.b);
        const absXA = Math.sqrt(norm(x.a));
        const absXB = Math.sqrt(norm(x.b));
        const r = Math.min(x.r, Math.max(0, (y.r - absXB * pixelSpacing) / absXA));
        blaTable[d + 1][j] = { a, b, r, l: x.l + y.l };
      } else {
        blaTable[d + 1][j] = blaTable[d][jx];
      }
    }
    if (blaTable[d + 1].length === 1) break;
  }

  // スキップ量が少なくデータ量が多いエントリを抜いておく
  for (let idx = 0; idx <= Math.log2(SKIP_BLA_ENTRY_UNTIL_THIS_L); idx++) {
    blaTable[idx] = [];
  }

  // console.debug("blaTable", blaTable);

  return blaTable;
}

/**
 * 別serverでrefOrbitを計算する
 *
 * FIXME: serverが立っていない場合はとりあえず勝手に落ちるに任せている
 */
async function calcRefOrbitExternal(
  referencePoint: ComplexArbitrary,
  maxIteration: number,
): Promise<Complex[]> {
  if (ws == null || ws.readyState !== WebSocket.OPEN) {
    return [];
  }

  const xnn: number[] = [];

  const promise = new Promise<void>((resolve) => {
    ws?.addEventListener(
      "message",
      (ev) => {
        const message = ev.data;
        if (typeof message === "string") {
          const data = JSON.parse(message);
          if (data.type === "error") {
            console.error("Received message:", data);
          } else {
            console.log("Received message:", data);
          }
        } else if (message instanceof ArrayBuffer) {
          const view = new DataView(message);
          const type = view.getUint8(0);

          if (type === 0x03) {
            for (let i = 1; i < view.byteLength; i += 8) {
              xnn.push(view.getFloat64(i, true));
            }
          }
        }
        resolve();
      },
      { once: true },
    );
  });

  ws.send(
    JSON.stringify({
      type: "calculation_request",
      x: referencePoint.re.toString(),
      y: referencePoint.im.toString(),
      maxIter: maxIteration,
    }),
  );

  await promise;

  const n = Math.floor(xnn.length / 2);
  const xn: Complex[] = [];

  for (let i = 0; i < n; i++) {
    xn.push({ re: xnn[i * 2], im: xnn[i * 2 + 1] });
  }

  return xn;
}

/**
 * websocket serverに接続できるならしておく
 */
async function initWebsocketServer() {
  ws = new WebSocket("ws://localhost:8080");
  ws.binaryType = "arraybuffer";

  return new Promise<void>((resolve, reject) => {
    if (ws == null) return reject("WebSocket is not initialized");

    ws.addEventListener("error", (event) => {
      console.error("Failed to connect to websocket server!", event);
      console.error("Check the server and refOrbit calculation rust client is running");
      reject(event);
    });
    ws.addEventListener("open", () => {
      console.log("Websocket connection established!");
      resolve();
    });
    // FIXME: 外からteminateされたときにWebSocketが閉じられない不具合がある
    // MandelbrotFacadeLikeのterminateで即worker.terminateを呼ぶのではなくちゃんと後始末する
    ws.addEventListener("close", () => {
      websocketServerConnected = false;
      ws = null;
      console.log("Websocket connection closed.");
    });
  });
}

/**
 * worker起動時に呼ばれる
 */
async function setup() {
  if (process.env.NODE_ENV === "development" && websocketServerConnected === false) {
    try {
      await initWebsocketServer();
      websocketServerConnected = true;
    } catch {
      console.warn("Failed to connect to websocket server");
    }
  }

  self.postMessage({ type: "init" });

  self.addEventListener("message", async (event) => {
    if (event.data.type === "calc-reference-orbit") {
      const {
        complexCenterX,
        complexCenterY,
        pixelHeight,
        pixelWidth,
        complexRadius: radiusStr,
        maxIteration,
        jobId,
        terminator,
        workerIdx,
      } = event.data as RefOrbitWorkerParams;

      const startedAt = performance.now();
      // console.debug(`${jobId}: start (ref)`);

      const terminateChecker = new Uint8Array(terminator);

      // 適当に中央のピクセルを参照点とする
      const refPixelX = Math.floor(pixelWidth / 2);
      const refPixelY = Math.floor(pixelHeight / 2);

      const center = complexArbitary(complexCenterX, complexCenterY);
      const radius = new BigNumber(radiusStr);

      const referencePoint = pixelToComplexCoordinateComplexArbitrary(
        refPixelX,
        refPixelY,
        center,
        radius,
        pixelWidth,
        pixelHeight,
      );

      let xn: Complex[] = [];

      try {
        // とりあえずrefOrbit計算serverは開発環境のみ使えるようにしておく
        // worker起動のタイミングでwebsocket serverが立ち上がってなかったら、次からローカルで計算する
        if (process.env.NODE_ENV === "development" && websocketServerConnected) {
          xn = await calcRefOrbitExternal(referencePoint, maxIteration);
        }
      } catch {
        console.warn("Failed to calculate refOrbit on external server. Fallback.");
      }

      if (xn.length === 0) {
        // この時点で計算結果がない場合はローカルで計算する
        const { xn: xn2 } = calcRefOrbit(referencePoint, maxIteration, terminateChecker, workerIdx);
        xn = xn2;
      }

      if (terminateChecker[workerIdx] !== 0) {
        console.debug(`${jobId}: terminated (ref)`);
        self.postMessage({
          type: "terminated",
        });
        return;
      }

      // console.log("Reference orbit calculated", xn);

      const pixelSpacing = radius.toNumber() / Math.max(pixelWidth, pixelHeight);
      const blaTable = calcBLACoefficient(xn, pixelSpacing);

      const xnConverted = encodeComplexArray(xn);
      const blaTableConverted = encodeBlaTableItems(blaTable);

      const elapsed = performance.now() - startedAt;

      self.postMessage({
        type: "result",
        xn: xnConverted,
        blaTable: blaTableConverted,
        elapsed,
      });

      // console.debug(`${jobId}: completed (ref)`);
    } else if (event.data.type === "request-shutdown") {
      console.log("Shutdown requested");
      ws?.close();
      self.postMessage({ type: "shutdown" });
    } else {
      console.error("Unknown message", event.data);
    }
  });
}

setup();

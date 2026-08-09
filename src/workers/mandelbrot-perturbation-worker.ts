/// <reference lib="webworker" />

import { generateLowResDiffSequence } from "../math/low-res-diff-sequence";
import { BLATableView, SKIP_BLA_ENTRY_UNTIL_THIS_L } from "./bla-table-item";
import { ComplexArrayView } from "./xn-buffer";
import BigNumber from "bignumber.js";
import wasmInit, {
  alloc_job,
  begin_iteration_job,
  begin_pass,
  bla_bytes_ptr,
  bla_row_offsets_ptr,
  calc_iteration_band,
  get_calculated_count,
  get_hit_count,
  scaled_iterations_ptr,
  xn_ptr,
} from "../../wasm-iter/pkg/mandelbrot_iter.js";
import type { IterationWorkerParams } from "../types";

/** progress postMessageのスロットリング間隔 */
const PROGRESS_INTERVAL_MS = 50;

let wasmMemory: WebAssembly.Memory | null = null;

/**
 * wasm-iterモジュールを初期化する。
 * workerスクリプトのロード直後に開始しておき、最初のcalc受信時に完了を待つ
 */
async function initWasm(): Promise<void> {
  const base = import.meta.env.BASE_URL ?? "/";
  const wasmUrl = new URL(`${base}wasm/mandelbrot_iter_bg.wasm`, self.location.origin);
  const output = await wasmInit(wasmUrl);
  wasmMemory = output.memory;
}

const initPromise = initWasm();

const calcHandler = (data: IterationWorkerParams) => {
  if (wasmMemory == null) throw new Error("wasm-iter is not initialized");
  const memory = wasmMemory;

  const {
    pixelHeight,
    pixelWidth,
    cx: cxStr,
    cy: cyStr,
    r: rStr,
    N: maxIteration,
    isSuperSampling,
    startX,
    endX,
    startY,
    endY,
    xn: xnBuffer,
    blaTable: blaTableBuffer,
    refX,
    refY,
    jobId,
    terminator,
    workerIdx,
  } = data;

  const startedAt = performance.now();

  const terminateChecker = new Uint8Array(terminator);

  const xnView = new ComplexArrayView(xnBuffer);
  const blaTableView = new BLATableView(blaTableBuffer);

  const areaWidth = endX - startX;
  const areaHeight = endY - startY;
  const pixelNum = areaHeight * areaWidth;
  const totalPixelCount = pixelNum * (isSuperSampling ? 4 : 1); // FIXME: supersamplingの倍率が固定値になっている

  const minDim = Math.min(pixelWidth, pixelHeight);

  // deltaCをdoubleで直接計算するための事前計算値
  const deltaCScale = (2 * Number(rStr)) / minDim;

  // refPixel = W/2 + (refX - cx) / (2r) * min(W, H)
  // pixelToComplexCoordinateComplexArbitrary の逆変換
  const r2 = new BigNumber(rStr).times(2);
  const refPixelX =
    Math.floor(pixelWidth / 2) + new BigNumber(refX).minus(cxStr).div(r2).times(minDim).toNumber();
  const refPixelY =
    Math.floor(pixelHeight / 2) - new BigNumber(refY).minus(cyStr).div(r2).times(minDim).toNumber();

  // データ節約のために空にしたBLATableの次のindexから開始
  const startBLAIndex = Math.floor(Math.log2(SKIP_BLA_ENTRY_UNTIL_THIS_L)) + 1;

  let { xDiffs, yDiffs } = generateLowResDiffSequence(6, areaWidth, areaHeight);

  if (isSuperSampling) {
    // FIXME: 2倍決め打ちになってしまっている
    xDiffs = [0.5];
    yDiffs = [0.5];
  }

  // scaled_iterationsのバッファサイズ決定用に、全passで最大となるscaled pixel数を求める
  let maxScaledPixels = 0;
  for (let i = 0; i < xDiffs.length; i++) {
    const scaledPixels = Math.floor(areaWidth / xDiffs[i]) * Math.floor(areaHeight / yDiffs[i]);
    if (maxScaledPixels < scaledPixels) maxScaledPixels = scaledPixels;
  }

  const xnF64Length = xnView.view.length;
  const blaBytesLength = blaTableBuffer.byteLength;
  const rowOffsetsLength = blaTableView.rowOffsets.length;

  // supersampling時はiterationsキャッシュを参照しないので確保させない
  alloc_job(
    xnF64Length,
    blaBytesLength,
    rowOffsetsLength,
    isSuperSampling ? 0 : pixelNum,
    maxScaledPixels,
  );

  // SAB → wasm memory へjobごとに1回だけコピーする。
  // wasm memoryはVec確保時にgrowしてArrayBufferが差し替わるので、
  // ptrの取得とviewの生成は必ずalloc_jobのあとに行うこと
  new Float64Array(memory.buffer, xn_ptr(), xnF64Length).set(xnView.view);
  new Uint8Array(memory.buffer, bla_bytes_ptr(), blaBytesLength).set(
    new Uint8Array(blaTableBuffer),
  );
  new Int32Array(memory.buffer, bla_row_offsets_ptr(), rowOffsetsLength).set(
    blaTableView.rowOffsets,
  );

  begin_iteration_job(
    maxIteration,
    xnView.length - 1,
    blaTableView.length,
    startBLAIndex,
    deltaCScale,
    refPixelX,
    refPixelY,
    areaWidth,
    areaHeight,
    startX,
    startY,
  );

  let lastProgressSentAt = 0;
  let terminated = false;

  for (let i = 0; i < xDiffs.length; i++) {
    const xDiff = xDiffs[i];
    const yDiff = yDiffs[i];

    // resultとして送るpassかどうか。hitCountはこのpassの書き込みだけを数える
    const isResultPass = isSuperSampling || i === xDiffs.length - 1;

    const scaledAreaWidth = Math.floor(areaWidth / xDiff);
    const scaledAreaHeight = Math.floor(areaHeight / yDiff);

    begin_pass(xDiff, yDiff, scaledAreaWidth, isSuperSampling, isResultPass);

    // JS版と同じくscaled-y 1行ごとにterminatorとprogressを見る。
    // 行単位に切っても呼び出し回数は1 passあたり高々数千回で、wasm境界のコストは誤差
    for (let scaledY = 0; scaledY < scaledAreaHeight; scaledY++) {
      calc_iteration_band(scaledY, scaledY + 1);

      if (terminateChecker[workerIdx] !== 0) {
        terminated = true;
        break;
      }

      const nowMs = performance.now();
      if (nowMs - lastProgressSentAt >= PROGRESS_INTERVAL_MS) {
        lastProgressSentAt = nowMs;
        self.postMessage({
          type: "progress",
          progress: get_calculated_count() / totalPixelCount,
        });
      }
    }

    if (terminated) break;

    // pass結果をwasm memoryからtransferできるバッファに複製する
    const scaledPixels = scaledAreaWidth * scaledAreaHeight;
    const scaledIterations = new Uint32Array(scaledPixels);
    scaledIterations.set(new Uint32Array(memory.buffer, scaled_iterations_ptr(), scaledPixels));

    if (isResultPass) {
      // 最終passの結果はintermediateResultではなくresultとして送り、
      // 別途末尾でiterationsを送り直す重複を避ける
      const elapsed = performance.now() - startedAt;
      self.postMessage(
        {
          type: "result",
          iterations: scaledIterations,
          resolution: { width: scaledAreaWidth, height: scaledAreaHeight },
          elapsed,
          hitCount: get_hit_count(),
        },
        [scaledIterations.buffer],
      );
    } else {
      self.postMessage(
        {
          type: "intermediateResult",
          iterations: scaledIterations,
          resolution: { width: scaledAreaWidth, height: scaledAreaHeight },
        },
        [scaledIterations.buffer],
      );
    }
  }

  if (terminateChecker[workerIdx] !== 0) {
    console.debug(`${jobId}: terminated`);
    self.postMessage({
      type: "terminated",
    });
  }
};

self.addEventListener("message", async (event) => {
  switch (event.data.type) {
    case "calc": {
      await initPromise;
      calcHandler(event.data);
      break;
    }
  }
});

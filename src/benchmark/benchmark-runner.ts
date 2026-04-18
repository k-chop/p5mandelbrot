import { getBatchTrace, type WorkerEvent } from "@/event-viewer/event";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import { startCalculation } from "@/mandelbrot";
import {
  getCurrentParams,
  getPrevBatchId,
  markAsRenderedWithCurrentParams,
  setCurrentParams,
} from "@/mandelbrot-state/mandelbrot-state";
import type { MandelbrotParams } from "@/types";
import { getBatchContext } from "@/worker-pool/worker-pool";
import { invalidateRefOrbitCache } from "@/worker-pool/ref-orbit-cache";
import BigNumber from "bignumber.js";
import type { BenchPOI } from "./bench-pois";
import { computeStats, type Stats } from "./benchmark-stats";

export type BenchmarkSample = {
  iteration: number;
  total: number;
  refOrbitWallclock: number;
  refOrbitSelf: number;
  refOrbitOverhead: number;
  iterPhaseWallclock: number;
  iterWorkerMax: number;
  iterWorkerMean: number;
  postProcessing: number;
};

const METRIC_KEYS = [
  "total",
  "refOrbitWallclock",
  "refOrbitSelf",
  "refOrbitOverhead",
  "iterPhaseWallclock",
  "iterWorkerMax",
  "iterWorkerMean",
  "postProcessing",
] as const satisfies readonly (keyof Omit<BenchmarkSample, "iteration">)[];

export type MetricKey = (typeof METRIC_KEYS)[number];

export type BenchmarkResult = {
  poi: BenchPOI;
  runs: number;
  warmup: number;
  samples: BenchmarkSample[];
  stats: Record<MetricKey, Stats>;
};

export type BenchmarkProgress = {
  totalRuns: number;
  completedRuns: number;
  phase: "warmup" | "sample" | "done";
};

export type BenchmarkAllProgress = {
  poiIndex: number;
  poiCount: number;
  poi: BenchPOI;
  runProgress: BenchmarkProgress;
};

/**
 * trace eventから単一runの計測値を抽出する
 */
const extractSample = (
  iteration: number,
  t0: number,
  t1: number,
  batchId: string,
): BenchmarkSample => {
  const trace = getBatchTrace(batchId);
  const batchCtx = getBatchContext(batchId);

  const total = t1 - t0;

  if (trace == null) {
    return zeroSample(iteration, total);
  }

  const workerEvents = trace.worker;

  const refEvents = workerEvents.filter((e) => e.workerId === "ref-orbit");
  const iterEvents = workerEvents.filter((e) => e.workerId.startsWith("iteration-"));

  const refLaunched = findEvent(refEvents, "launched");
  const refCompleted = findEvent(refEvents, "completed");
  const refOrbitWallclock =
    refLaunched != null && refCompleted != null ? refCompleted.time - refLaunched.time : 0;

  const refOrbitSelf = batchCtx?.spans.find((s) => s.name === "reference_orbit")?.elapsed ?? 0;
  const refOrbitOverhead = refOrbitWallclock > 0 ? refOrbitWallclock - refOrbitSelf : 0;

  const iterLaunchedTimes = iterEvents.filter((e) => e.type === "launched").map((e) => e.time);
  const iterCompletedTimes = iterEvents.filter((e) => e.type === "completed").map((e) => e.time);

  const iterStart = iterLaunchedTimes.length > 0 ? Math.min(...iterLaunchedTimes) : 0;
  const iterEnd = iterCompletedTimes.length > 0 ? Math.max(...iterCompletedTimes) : 0;
  const iterPhaseWallclock = iterEnd - iterStart;

  const perWorker = computePerWorkerWallclock(iterEvents);
  const iterWorkerMax = perWorker.length > 0 ? Math.max(...perWorker) : 0;
  const iterWorkerMean =
    perWorker.length > 0 ? perWorker.reduce((a, b) => a + b, 0) / perWorker.length : 0;

  // onComplete発火時刻(t1)からbench基準で計測。iterEnd(absolute) との差は計算できないので、
  // 代わりにspansのmax vs total で近似する... ではなく、iterEnd は AbsoluteTime(performance.timeOrigin + performance.now()) なので
  // bench の t1 も同じ基準に合わせて引けばよい
  const t1Abs = performance.timeOrigin + t1;
  const postProcessing = iterEnd > 0 ? t1Abs - iterEnd : 0;

  return {
    iteration,
    total,
    refOrbitWallclock,
    refOrbitSelf,
    refOrbitOverhead,
    iterPhaseWallclock,
    iterWorkerMax,
    iterWorkerMean,
    postProcessing,
  };
};

/**
 * iter workerの launched→completed を workerId ごとにペアリングして elapsed を返す
 */
const computePerWorkerWallclock = (events: WorkerEvent[]): number[] => {
  const launchedMap = new Map<string, number>();
  const results: number[] = [];
  for (const e of events) {
    if (e.type === "launched") {
      launchedMap.set(e.workerId, e.time);
    } else if (e.type === "completed") {
      const l = launchedMap.get(e.workerId);
      if (l != null) {
        results.push(e.time - l);
        launchedMap.delete(e.workerId);
      }
    }
  }
  return results;
};

/**
 * worker eventsから特定typeの最初のeventを探す
 */
const findEvent = (events: WorkerEvent[], type: WorkerEvent["type"]) =>
  events.find((e) => e.type === type);

const zeroSample = (iteration: number, total: number): BenchmarkSample => ({
  iteration,
  total,
  refOrbitWallclock: 0,
  refOrbitSelf: 0,
  refOrbitOverhead: 0,
  iterPhaseWallclock: 0,
  iterWorkerMax: 0,
  iterWorkerMean: 0,
  postProcessing: 0,
});

/**
 * BenchPOIから MandelbrotParams を組み立てる
 */
const poiToParams = (poi: BenchPOI): MandelbrotParams => ({
  x: new BigNumber(poi.x),
  y: new BigNumber(poi.y),
  r: new BigNumber(poi.r),
  N: poi.N,
  mode: poi.mode,
  isSuperSampling: false,
});

/**
 * 指定POIに対してwarmup+runs回のベンチを実行する
 *
 * 各runの前にiterationCacheとrefOrbitCacheをクリアして同条件にする
 */
export const runBenchmark = async (
  poi: BenchPOI,
  opts: { runs: number; warmup: number },
  onProgress?: (p: BenchmarkProgress) => void,
): Promise<BenchmarkResult> => {
  const savedParams = getCurrentParams();

  const benchParams = poiToParams(poi);
  setCurrentParams(benchParams);
  markAsRenderedWithCurrentParams();

  const samples: BenchmarkSample[] = [];
  const totalRuns = opts.runs + opts.warmup;

  try {
    for (let i = 0; i < totalRuns; i++) {
      const isWarmup = i < opts.warmup;
      onProgress?.({
        totalRuns,
        completedRuns: i,
        phase: isWarmup ? "warmup" : "sample",
      });

      clearIterationCache();
      invalidateRefOrbitCache();

      const t0 = performance.now();

      await new Promise<void>((resolve) => {
        void startCalculation(
          () => resolve(),
          () => {},
        );
      });

      const t1 = performance.now();
      const batchId = getPrevBatchId();

      if (!isWarmup) {
        samples.push(extractSample(i - opts.warmup, t0, t1, batchId));
      }
    }
  } finally {
    setCurrentParams(savedParams);
    markAsRenderedWithCurrentParams();
  }

  onProgress?.({ totalRuns, completedRuns: totalRuns, phase: "done" });

  const stats: Record<MetricKey, Stats> = {} as Record<MetricKey, Stats>;
  for (const key of METRIC_KEYS) {
    stats[key] = computeStats(samples.map((s) => s[key]));
  }

  return {
    poi,
    runs: opts.runs,
    warmup: opts.warmup,
    samples,
    stats,
  };
};

/**
 * 複数POIに対して順番にベンチを実行する
 */
export const runAllBenchmarks = async (
  pois: BenchPOI[],
  opts: { runs: number; warmup: number },
  onProgress?: (p: BenchmarkAllProgress) => void,
): Promise<BenchmarkResult[]> => {
  const results: BenchmarkResult[] = [];
  for (let i = 0; i < pois.length; i++) {
    const poi = pois[i];
    const result = await runBenchmark(poi, opts, (runProgress) =>
      onProgress?.({
        poiIndex: i,
        poiCount: pois.length,
        poi,
        runProgress,
      }),
    );
    results.push(result);
  }
  return results;
};

/**
 * ベンチマーク結果をmarkdown tableに整形する
 */
export const formatResultAsMarkdown = (result: BenchmarkResult): string => {
  const { poi, samples, stats } = result;
  const lines: string[] = [];

  lines.push(`## Benchmark: ${poi.label} (${poi.id})`);
  lines.push(`- N=${poi.N}, mode=${poi.mode}, r=${poi.r}`);
  if (poi.note) lines.push(`- note: ${poi.note}`);
  lines.push(`- runs=${result.runs}, warmup=${result.warmup}`);
  lines.push("");

  lines.push("### Samples (ms)");
  lines.push(
    "| # | total | refOrbit(wc) | refOrbit(self) | iter(wc) | iter-max | iter-mean | post |",
  );
  lines.push(
    "|---|------:|-------------:|---------------:|---------:|---------:|----------:|-----:|",
  );
  for (const s of samples) {
    lines.push(
      `| ${s.iteration + 1} | ${fmt(s.total)} | ${fmt(s.refOrbitWallclock)} | ${fmt(s.refOrbitSelf)} | ${fmt(s.iterPhaseWallclock)} | ${fmt(s.iterWorkerMax)} | ${fmt(s.iterWorkerMean)} | ${fmt(s.postProcessing)} |`,
    );
  }
  lines.push("");

  lines.push("### Stats (ms)");
  lines.push("| metric | min | median | mean | max |");
  lines.push("|--------|----:|-------:|-----:|----:|");
  for (const key of METRIC_KEYS) {
    const s = stats[key];
    lines.push(`| ${key} | ${fmt(s.min)} | ${fmt(s.median)} | ${fmt(s.mean)} | ${fmt(s.max)} |`);
  }

  return lines.join("\n");
};

/**
 * 複数POIをまたがったsummary tableをmarkdownで出力する
 *
 * 各POIの主要メトリクスのmedianを1行に並べる
 */
export const formatSummaryAsMarkdown = (results: BenchmarkResult[]): string => {
  const lines: string[] = [];
  lines.push("## Summary (median ms)");
  lines.push("| POI | total | ref(wc) | ref(self) | iter(wc) | iter-max | iter-mean | post |");
  lines.push("|-----|------:|--------:|----------:|---------:|---------:|----------:|-----:|");
  for (const r of results) {
    const s = r.stats;
    lines.push(
      `| ${r.poi.label} | ${fmt(s.total.median)} | ${fmt(s.refOrbitWallclock.median)} | ${fmt(s.refOrbitSelf.median)} | ${fmt(s.iterPhaseWallclock.median)} | ${fmt(s.iterWorkerMax.median)} | ${fmt(s.iterWorkerMean.median)} | ${fmt(s.postProcessing.median)} |`,
    );
  }
  return lines.join("\n");
};

/**
 * 複数ベンチマーク結果をまとめてmarkdownに整形する
 *
 * 先頭にsummary、その後に各POIの詳細テーブルを出力する
 */
export const formatAllResultsAsMarkdown = (results: BenchmarkResult[]): string => {
  return [formatSummaryAsMarkdown(results), ...results.map((r) => formatResultAsMarkdown(r))].join(
    "\n\n---\n\n",
  );
};

const fmt = (n: number) => n.toFixed(1);

export { METRIC_KEYS };

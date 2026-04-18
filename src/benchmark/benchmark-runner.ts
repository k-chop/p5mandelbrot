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
  refOrbit: number;
  iter: number;
  iterMean: number;
};

const METRIC_KEYS = [
  "total",
  "refOrbit",
  "iter",
  "iterMean",
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
 * batchContextのspansから単一runの計測値を抽出する
 *
 * refOrbit: spans[name="reference_orbit"].elapsed
 * iter: spans[name="iteration_*"].elapsedのmax (bottleneck worker)
 * iterMean: 同じspansのmean
 */
const extractSample = (
  iteration: number,
  t0: number,
  t1: number,
  batchId: string,
): BenchmarkSample => {
  const batchCtx = getBatchContext(batchId);
  const total = t1 - t0;

  if (batchCtx == null) {
    return { iteration, total, refOrbit: 0, iter: 0, iterMean: 0 };
  }

  const refOrbit = batchCtx.spans.find((s) => s.name === "reference_orbit")?.elapsed ?? 0;

  const iterElapsed = batchCtx.spans
    .filter((s) => s.name.startsWith("iteration_"))
    .map((s) => s.elapsed);
  const iter = iterElapsed.length > 0 ? Math.max(...iterElapsed) : 0;
  const iterMean =
    iterElapsed.length > 0 ? iterElapsed.reduce((a, b) => a + b, 0) / iterElapsed.length : 0;

  return { iteration, total, refOrbit, iter, iterMean };
};

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
 * 単一POIのベンチマーク結果をmarkdownに整形する
 *
 * Samplesテーブル (# / total / refOrbit / iter) と Statsテーブル (metric / min / max / trimmedMean)
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
  lines.push("| # | total | refOrbit | iter | iterMean |");
  lines.push("|---|------:|---------:|-----:|---------:|");
  for (const s of samples) {
    lines.push(
      `| ${s.iteration + 1} | ${fmt(s.total)} | ${fmt(s.refOrbit)} | ${fmt(s.iter)} | ${fmt(s.iterMean)} |`,
    );
  }
  lines.push("");

  lines.push("### Stats (ms)");
  lines.push("| metric | min | max | trimmed-mean |");
  lines.push("|--------|----:|----:|-------------:|");
  for (const key of METRIC_KEYS) {
    const s = stats[key];
    lines.push(`| ${key} | ${fmt(s.min)} | ${fmt(s.max)} | ${fmt(s.trimmedMean)} |`);
  }

  return lines.join("\n");
};

/**
 * 複数POIをまたがったsummaryをmarkdownで出力する
 *
 * 各POIに対してtotal/ref/iterのtrimmed-meanと(min - max)を出力する
 */
export const formatSummaryAsMarkdown = (results: BenchmarkResult[]): string => {
  const lines: string[] = [];
  lines.push("## Summary (ms, trimmed-mean)");
  for (const r of results) {
    lines.push(`${r.poi.label}:`);
    lines.push(`- total: ${formatMetric(r.stats.total)}`);
    lines.push(`- ref: ${formatMetric(r.stats.refOrbit)}`);
    lines.push(`- iter: ${formatMetric(r.stats.iter)}`);
  }
  return lines.join("\n");
};

const formatMetric = (s: Stats): string =>
  `${fmt(s.trimmedMean)}ms (${fmt(s.min)} - ${fmt(s.max)})`;

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

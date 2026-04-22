import { BENCH_POIS } from "@/benchmark/bench-pois";
import {
  formatAllResultsAsMarkdown,
  METRIC_KEYS,
  runAllBenchmarks,
  type BenchmarkAllProgress,
  type BenchmarkResult,
} from "@/benchmark/benchmark-runner";
import type { Stats } from "@/benchmark/benchmark-stats";
import { Button } from "@/shadcn/components/ui/button";
import { Checkbox } from "@/shadcn/components/ui/check";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/ui/dialog";
import { Label } from "@/shadcn/components/ui/label";
import { Slider } from "@/shadcn/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/components/ui/table";
import { IconCircleCheck, IconCopy } from "@tabler/icons-react";
import { VisuallyHidden } from "radix-ui";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Debug modeのBenchmarkタブ
 *
 * 選択されたPOI群に対して warmup+runs 回 startCalculation を走らせ、各フェーズの時間を集計する
 */
export const BenchmarkViewer = () => {
  const [runs, setRuns] = useState(5);
  const [warmup, setWarmup] = useState(1);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BenchmarkAllProgress | null>(null);
  const [results, setResults] = useState<BenchmarkResult[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(BENCH_POIS.map((p) => p.id)),
  );

  const selectedPois = useMemo(
    () => BENCH_POIS.filter((p) => selectedIds.has(p.id)),
    [selectedIds],
  );
  const allChecked = selectedPois.length === BENCH_POIS.length;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allChecked ? new Set() : new Set(BENCH_POIS.map((p) => p.id)));
  };

  const onRun = async () => {
    if (selectedPois.length === 0) return;
    setRunning(true);
    setResults(null);
    try {
      const rs = await runAllBenchmarks(selectedPois, { runs, warmup }, (p) => setProgress(p));
      setResults(rs);
    } catch (e) {
      console.error("Benchmark failed:", e);
      toast.error(`Benchmark failed: ${String(e)}`);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const onCopyAll = async () => {
    if (!results) return;
    const md = formatAllResultsAsMarkdown(results);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (BENCH_POIS.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        No benchmark POIs defined. Add entries to <code>src/benchmark/bench-pois.ts</code>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Runs</Label>
          <span className="text-muted-foreground text-sm tabular-nums">{runs}</span>
        </div>
        <Slider min={1} max={10} step={1} value={[runs]} onValueChange={([v]) => setRuns(v)} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Warmup</Label>
          <span className="text-muted-foreground text-sm tabular-nums">{warmup}</span>
        </div>
        <Slider min={0} max={3} step={1} value={[warmup]} onValueChange={([v]) => setWarmup(v)} />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold">
            POIs ({selectedPois.length} / {BENCH_POIS.length}) — total{" "}
            {selectedPois.length * (runs + warmup)} runs
          </div>
        </div>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="text-right">N</TableHead>
              <TableHead>mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {BENCH_POIS.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => toggle(p.id)}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell>{p.label}</TableCell>
                <TableCell className="text-right tabular-nums">{p.N}</TableCell>
                <TableCell>{p.mode}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button onClick={onRun} disabled={running || selectedPois.length === 0} className="w-full">
        Run selected benchmarks
      </Button>

      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm font-semibold">Results ({results.length} POIs)</div>
            <Button size="sm" variant="outline" onClick={onCopyAll}>
              {copied ? (
                <>
                  <IconCircleCheck className="mr-1 size-4" /> Copied
                </>
              ) : (
                <>
                  <IconCopy className="mr-1 size-4" /> Copy all (md)
                </>
              )}
            </Button>
          </div>

          <SummarySection results={results} />

          {results.map((result) => (
            <ResultSection key={result.poi.id} result={result} />
          ))}
        </div>
      )}

      <Dialog open={running}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Benchmark running...</DialogTitle>
            <VisuallyHidden.Root>
              <DialogDescription>Benchmark progress</DialogDescription>
            </VisuallyHidden.Root>
          </DialogHeader>
          {progress ? (
            <div className="space-y-2 text-sm">
              <div>
                POI <strong>{progress.poiIndex + 1}</strong> / {progress.poiCount}:{" "}
                {progress.poi.label}
              </div>
              <div className="text-muted-foreground">
                {progress.runProgress.phase}: {progress.runProgress.completedRuns} /{" "}
                {progress.runProgress.totalRuns}
              </div>
            </div>
          ) : (
            <div className="text-sm">Starting...</div>
          )}
          <div className="text-muted-foreground text-xs">操作しないでください</div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/**
 * 全POIのtotal/ref/iterをPOIごとにまとめたシンプルなsummary
 *
 * フォーマット:
 *   <label>:
 *   - total: <trimmed>ms (<min> - <max>)
 *   - ref: <trimmed>ms (<min> - <max>)
 *   - iter: <trimmed>ms (<min> - <max>)
 */
const SummarySection = ({ results }: { results: BenchmarkResult[] }) => {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold">Summary (ms, trimmed-mean)</div>
      <div className="space-y-2 font-mono text-xs">
        {results.map((r) => (
          <div key={r.poi.id}>
            <div>{r.poi.label}:</div>
            <MetricLine label="total" stats={r.stats.total} />
            <MetricLine label="ref" stats={r.stats.refOrbit} />
            <MetricLine label="iter" stats={r.stats.iter} />
          </div>
        ))}
      </div>
    </div>
  );
};

const MetricLine = ({ label, stats }: { label: string; stats: Stats }) => (
  <div>
    - {label}: <span className="font-semibold">{fmt(stats.trimmedMean)}ms</span>{" "}
    <span className="text-muted-foreground">
      ({fmt(stats.min)} - {fmt(stats.max)})
    </span>
  </div>
);

/**
 * 単一POIの実行結果（sampleテーブル + statsテーブル）を描画する
 */
const ResultSection = ({ result }: { result: BenchmarkResult }) => {
  return (
    <div className="space-y-2 border-t pt-3">
      <div className="text-sm font-semibold">{result.poi.label}</div>
      <div className="text-muted-foreground text-xs">
        N={result.poi.N}, {result.poi.mode}
      </div>

      <div className="overflow-x-auto">
        <div className="mb-1 text-xs font-semibold">Samples (ms)</div>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead className="text-right">total</TableHead>
              <TableHead className="text-right">refOrbit</TableHead>
              <TableHead className="text-right">iter</TableHead>
              <TableHead className="text-right">iterMean</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.samples.map((s) => (
              <TableRow key={s.iteration}>
                <TableCell>{s.iteration + 1}</TableCell>
                <TableCell className="text-right">{fmt(s.total)}</TableCell>
                <TableCell className="text-right">{fmt(s.refOrbit)}</TableCell>
                <TableCell className="text-right">{fmt(s.iter)}</TableCell>
                <TableCell className="text-right">{fmt(s.iterMean)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="overflow-x-auto">
        <div className="mb-1 text-xs font-semibold">Stats (ms)</div>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>metric</TableHead>
              <TableHead className="text-right">min</TableHead>
              <TableHead className="text-right">max</TableHead>
              <TableHead className="text-right">trimmed-mean</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRIC_KEYS.map((key) => {
              const s = result.stats[key];
              return (
                <TableRow key={key}>
                  <TableCell className="font-mono">{key}</TableCell>
                  <TableCell className="text-right">{fmt(s.min)}</TableCell>
                  <TableCell className="text-right">{fmt(s.max)}</TableCell>
                  <TableCell className="text-right">{fmt(s.trimmedMean)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const fmt = (n: number) => n.toFixed(1);

BenchmarkViewer.displayName = "BenchmarkViewer";

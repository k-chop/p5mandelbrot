import clsx from "clsx";
import { Tooltip } from "radix-ui";
import React from "react";
import { useT } from "../../i18n/context";
import { Separator } from "../../shadcn/components/ui/separator";
import { useStoreValue } from "../../store/store";
import type { ResultSpans, Span } from "../../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convertSpans = (value: any): ResultSpans | undefined => {
  if (value !== null && typeof value === "object") {
    const total = value.total;
    const spans = value.spans;

    if (typeof total === "number" && Array.isArray(spans)) {
      return { total, spans };
    }
  }

  return undefined;
};

export const Footer = () => {
  const t = useT();
  const progress = useStoreValue("progress");

  if (typeof progress === "string") {
    return <>{progress}</>;
  }

  const result = convertSpans(progress);
  if (result == null) return t("Invalid Result");

  const { total, spans } = result;

  return (
    <div>
      <BarGraph total={total} spans={spans} />
    </div>
  );
};

const colorMap = (label: string) => {
  if (label.includes("reference")) {
    return "bg-jade-7";
  }
  if (label.includes("iteration")) {
    return "bg-iris-7";
  }
  if (label === "flush") {
    return "bg-tomato-7";
  }
  if (label === "drain") {
    return "bg-lime-7";
  }
  return "bg-sage-7";
};

const BarGraph = (props: ResultSpans) => {
  const { total, spans } = props;

  return (
    <Tooltip.Provider>
      <div className="flex w-full items-center">
        <Tooltip.Root delayDuration={0}>
          <Tooltip.Trigger className="mr-4 flex-none">Done! ({total}ms)</Tooltip.Trigger>
          <TooltipPanel>
            <AllSpansDetail spans={spans} />
          </TooltipPanel>
        </Tooltip.Root>
        <div className="flex min-w-0 grow">
          <Bar spans={spans} total={total} />
        </div>
      </div>
    </Tooltip.Provider>
  );
};

/**
 * 全spanの内訳をリスト表示する
 *
 * バーが細くてホバーできないspan (flush, queue-wait, drain など) もここで確認できる。
 * iteration_* はworker数だけあるので最大値1行にまとめる。
 */
const AllSpansDetail = (props: { spans: Span[] }) => {
  const { spans } = props;

  const iterationSpans = spans.filter((s) => s.name.includes("iteration"));
  const otherSpans = spans.filter((s) => !s.name.includes("iteration"));

  return (
    <div>
      {otherSpans.map((span, idx) => (
        <React.Fragment key={span.name}>
          {idx > 0 && <Separator />}
          <ListItem label={span.name} value={`${span.elapsed} ms`} />
        </React.Fragment>
      ))}
      {iterationSpans.length > 0 && (
        <>
          <Separator />
          <ListItem
            label={`iteration (max of ${iterationSpans.length})`}
            value={`${Math.max(...iterationSpans.map((s) => s.elapsed))} ms`}
          />
        </>
      )}
    </div>
  );
};

const Bar = (props: ResultSpans) => {
  const { spans, total } = props;

  const maxIterationElapsed = Math.max(
    ...spans.filter((s) => s.name.includes("iteration")).map((s) => s.elapsed),
  );
  const iterationExceptedSpans = spans.filter((s) => !s.name.includes("iteration"));
  const iterationSpans = spans.filter((s) => s.name.includes("iteration"));

  return (
    <div className="bg-gray-7 flex h-8 w-full overflow-hidden rounded-sm">
      {iterationExceptedSpans.map((span) => (
        <BarContent
          key={span.name}
          name={span.name}
          elapsed={span.elapsed}
          total={total}
          spans={[span]}
        />
      ))}
      <BarContent
        name="iteration"
        elapsed={maxIterationElapsed}
        total={total}
        spans={iterationSpans}
      />
    </div>
  );
};

/**
 * 1フェーズ分の色帯
 *
 * 幅が狭いフェーズではラベルが読めないので、バーは色分けのみとし詳細はホバーで出す
 */
const BarContent = (props: { name: string; elapsed: number; total: number; spans: Span[] }) => {
  const { name, elapsed, total, spans } = props;

  const width = (elapsed / total) * 100;

  return (
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger asChild>
        <div className={clsx("h-full", colorMap(name))} style={{ width: `${width}%` }} />
      </Tooltip.Trigger>
      <TooltipPanel>
        <SpansDetail name={name} spans={spans} />
      </TooltipPanel>
    </Tooltip.Root>
  );
};

/**
 * ホバー内容を載せるパネル
 *
 * z-indexはcanvasより手前に出すため
 */
const TooltipPanel = (props: { children: React.ReactNode }) => (
  <Tooltip.Content side="top" sideOffset={4} className="z-200">
    <div className="bg-popover text-popover-foreground border-border w-64 rounded-md border p-2 shadow-lg">
      {props.children}
    </div>
  </Tooltip.Content>
);

const SpansDetail = (props: { name: string; spans: Span[] }) => {
  const t = useT();
  const { name, spans } = props;

  const label = nameToLabel(name, t);

  if (spans.length === 1) {
    return (
      <div>
        <div className="pb-2">{label}</div>
        <ListItem label="Total" value={`${spans[0].elapsed} ms`} />
      </div>
    );
  }

  const elapses = spans.map((s) => s.elapsed);
  const maxElapsed = Math.max(...elapses);
  const minElapsed = Math.min(...elapses);
  const totalElapsed = elapses.reduce((acc, cur) => acc + cur, 0);
  const averageElapsed = (totalElapsed / elapses.length).toFixed(1);

  return (
    <div>
      <div className="pb-2">{label}</div>
      <ListItem label="Max" value={`${maxElapsed} ms`} />
      <Separator />
      <ListItem label="Min" value={`${minElapsed} ms`} />
      <Separator />
      <ListItem label="Count" value={`${elapses.length} workers`} />
      <Separator />
      <ListItem label="Average" value={`${averageElapsed} ms`} />
    </div>
  );
};

const nameToLabel = (name: string, t: ReturnType<typeof useT>) => {
  if (name.includes("reference")) {
    return t("Calculate Reference Orbit");
  }
  if (name.includes("iteration")) {
    return t("Calculate Iteration");
  }
  return name;
};

const ListItem = (props: { label: string; value: string }) => {
  const { label, value } = props;

  return (
    <div className="flex justify-between">
      <div>{label}:</div>
      <div>{value}</div>
    </div>
  );
};

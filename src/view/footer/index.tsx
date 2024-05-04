import { ResultSpans, Span } from "@/types";
import { useStoreValue } from "../../store/store";
import clsx from "clsx";
import React from "react";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@radix-ui/react-tooltip";
import { Separator } from "@/components/ui/separator";

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
  const progress = useStoreValue("progress");

  if (typeof progress === "string") {
    return <>{progress}</>;
  }

  const result = convertSpans(progress);
  if (result == null) return "Invalid Result";

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
  return "bg-ruby-7";
};

const BarGraph = (props: ResultSpans) => {
  const { total, spans } = props;

  return (
    <TooltipProvider>
      <div className="flex w-full items-center">
        <div className="mr-4 flex-none">Done! ({total}ms)</div>
        <div className="flex flex-grow">
          <Bar spans={spans} total={total} />
        </div>
      </div>
    </TooltipProvider>
  );
};

const Bar = (props: ResultSpans) => {
  const { spans, total } = props;

  const maxIterationElapsed = Math.max(
    ...spans.filter((s) => s.name.includes("iteration")).map((s) => s.elapsed),
  );
  const iterationExceptedSpans = spans.filter(
    (s) => !s.name.includes("iteration"),
  );
  const iterationSpans = spans.filter((s) => s.name.includes("iteration"));

  return (
    <div className="flex h-8 w-full bg-gray-7">
      {iterationExceptedSpans.map((span, idx) => (
        <BarContent
          key={idx}
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

const BarContent = (props: {
  name: string;
  elapsed: number;
  total: number;
  spans: Span[];
}) => {
  const { name, elapsed, total, spans } = props;

  const [displayText, setDisplayText] = React.useState(`${name}: ${elapsed}ms`);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (ref.current && ref.current.offsetWidth < ref.current.scrollWidth) {
      // 実際の幅がコンテナの幅より大きい場合は、`elapsed` のみを表示
      setDisplayText(`${elapsed}ms`);
    }
  }, [name, elapsed]);

  const width = (elapsed / total) * 100;
  const bgColorClassName = colorMap(name);

  return (
    <Tooltip delayDuration={0}>
      <div
        ref={ref}
        className={clsx(
          "flex w-52 items-center justify-center overflow-hidden overflow-ellipsis whitespace-nowrap text-whiteA-12",
          bgColorClassName,
        )}
        style={{ width: `${width}%` }}
      >
        <TooltipTrigger>{displayText}</TooltipTrigger>
      </div>
      <TooltipContent>
        <div
          className={clsx(
            "w-52 rounded-md p-2 text-whiteA-12",
            bgColorClassName,
          )}
        >
          <SpansDetail name={name} spans={spans} />
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const SpansDetail = (props: { name: string; spans: Span[] }) => {
  const { name, spans } = props;

  const label = nameToLabel(name);

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

const nameToLabel = (name: string) => {
  if (name.includes("reference")) {
    return "Calculate Reference Point";
  }
  if (name.includes("iteration")) {
    return "Calculate Iteration";
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

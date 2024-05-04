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
          "flex items-center justify-center overflow-hidden overflow-ellipsis whitespace-nowrap text-whiteA-12",
          bgColorClassName,
        )}
        style={{ width: `${width}%` }}
      >
        <TooltipTrigger>{displayText}</TooltipTrigger>
      </div>
      <TooltipContent>
        <div className="rounded-md bg-iris-5 p-2 text-whiteA-12">
          {spans.map((span, idx) => {
            return (
              <div key={idx}>
                {span.name}: {span.elapsed}ms
              </div>
            );
          })}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

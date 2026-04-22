import { useT } from "@/i18n/context";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import {
  getCurrentParams,
  setCurrentParams,
  setManualN,
} from "@/mandelbrot-state/mandelbrot-state";
import { Button } from "@/shadcn/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/ui/dialog";
import { Input } from "@/shadcn/components/ui/input";
import { Label } from "@/shadcn/components/ui/label";
import { Textarea } from "@/shadcn/components/ui/textarea";
import BigNumber from "bignumber.js";
import { VisuallyHidden } from "radix-ui";
import { useState } from "react";

/** パラメータ名のエイリアスマッピング */
const PARAM_ALIASES: Record<string, "x" | "y" | "r" | "zoom" | "N"> = {
  x: "x",
  real: "x",
  re: "x",
  y: "y",
  imag: "y",
  im: "y",
  r: "r",
  radius: "r",
  z: "zoom",
  zoom: "zoom",
  n: "N",
  max_iter: "N",
  max_iteration: "N",
};

type ParsedParams = {
  x: string;
  y: string;
  r: string;
  N: string;
};

/**
 * テキストからマンデルブロパラメータをパースする
 *
 * `key=value` or `key: value` 形式に対応。
 * デリミタはカンマ・改行・空白。
 */
const parseCoordinateText = (text: string): { params: ParsedParams; error: string | null } => {
  const result: ParsedParams = { x: "", y: "", r: "", N: "" };

  if (text.trim() === "") {
    return { params: result, error: null };
  }

  // key=value or key: value のパターンを全てマッチ（値が"..."で囲まれていてもOK）
  const pattern = /(\w+)\s*[:=]\s*"?([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)"?/gi;
  let matched = false;

  for (const match of text.matchAll(pattern)) {
    const rawKey = match[1].toLowerCase();
    const value = match[2];
    const normalized = PARAM_ALIASES[rawKey];

    if (normalized == null) continue;

    matched = true;

    if (normalized === "zoom") {
      // zoom → r 変換: r = 2 / zoom
      // 非常に大きなzoom値（e308等）に対応するため高精度で除算する
      try {
        const HighPrecision = BigNumber.clone({ DECIMAL_PLACES: 400 });
        const zoomValue = new HighPrecision(value);
        if (zoomValue.isFinite() && zoomValue.gt(0)) {
          result.r = new HighPrecision(2).div(zoomValue).toString();
        }
      } catch {
        // 無効な値は無視
      }
    } else {
      result[normalized] = value;
    }
  }

  if (!matched) {
    return { params: result, error: "PARSE_ERROR" };
  }

  return { params: result, error: null };
};

type JumpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** 座標を指定してジャンプするダイアログ */
export const JumpDialog = ({ open, onOpenChange }: JumpDialogProps) => {
  const t = useT();
  const [rawText, setRawText] = useState("");
  const [params, setParams] = useState<ParsedParams>({ x: "", y: "", r: "", N: "" });
  const [parseError, setParseError] = useState<string | null>(null);

  const canJump = params.x.trim() !== "" && params.y.trim() !== "";

  /** エラーコードを翻訳済みメッセージに変換する */
  const resolveError = (error: string | null): string | null => {
    if (error == null) return null;
    const errorMap: Record<string, string> = {
      PARSE_ERROR: t("Could not recognize parameters", "toolbar.parseError"),
      INVALID_COORDINATES: t("Invalid coordinate values", "toolbar.invalidCoordinates"),
      INVALID_RADIUS: t("Invalid radius value", "toolbar.invalidRadius"),
      INVALID_ITERATION: t("Invalid iteration count", "toolbar.invalidIteration"),
      PARSE_FAILED: t("Failed to parse parameter values", "toolbar.parseFailed"),
    };
    return errorMap[error] ?? error;
  };

  /** textareaの内容をパースしてinputに反映する */
  const handleTextChange = (text: string) => {
    setRawText(text);
    const { params: parsed, error } = parseCoordinateText(text);
    setParams(parsed);
    setParseError(error);
  };

  /** 個別inputの変更ハンドラ */
  const handleParamChange = (key: keyof ParsedParams, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  /** ジャンプ実行 */
  const handleJump = () => {
    const current = getCurrentParams();

    try {
      const x = new BigNumber(params.x);
      const y = new BigNumber(params.y);
      if (!x.isFinite() || !y.isFinite()) {
        setParseError("INVALID_COORDINATES");
        return;
      }

      const r = params.r.trim() !== "" ? new BigNumber(params.r) : current.r;
      if (!r.isFinite() || r.lte(0)) {
        setParseError("INVALID_RADIUS");
        return;
      }

      const N = params.N.trim() !== "" ? Number.parseInt(params.N, 10) : current.N;
      if (!Number.isFinite(N) || N <= 0) {
        setParseError("INVALID_ITERATION");
        return;
      }

      setManualN(N);
      // modeはsetCurrentParams側でrから自動決定される
      setCurrentParams({ x, y, r, N });
      clearIterationCache();

      // ダイアログを閉じてリセット
      onOpenChange(false);
      setRawText("");
      setParams({ x: "", y: "", r: "", N: "" });
      setParseError(null);
    } catch {
      setParseError("PARSE_FAILED");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("Jump to Coordinates", "toolbar.jumpToCoordinates")}</DialogTitle>
          <VisuallyHidden.Root>
            <DialogDescription>
              {t("Jump to specified coordinates", "dialog.description.jump")}
            </DialogDescription>
          </VisuallyHidden.Root>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("Paste coordinates", "toolbar.pasteCoordinates")}</Label>
            <Textarea
              placeholder={"x=-1.408, y=0.136, r=2e-7, N=500\nreal: -1.408 imag: 0.136 zoom: 1e10"}
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              className="h-[250px] break-all font-mono text-xs placeholder:opacity-30"
            />
            {parseError && <p className="text-xs text-destructive">{resolveError(parseError)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                x <span className="opacity-60">(real)</span>
              </Label>
              <Input
                value={params.x}
                onChange={(e) => handleParamChange("x", e.target.value)}
                placeholder="0"
                className="h-8 min-w-0 font-mono text-xs placeholder:opacity-30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                y <span className="opacity-60">(imag)</span>
              </Label>
              <Input
                value={params.y}
                onChange={(e) => handleParamChange("y", e.target.value)}
                placeholder="0"
                className="h-8 min-w-0 font-mono text-xs placeholder:opacity-30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                r <span className="opacity-60">(radius)</span>
              </Label>
              <Input
                value={params.r}
                onChange={(e) => handleParamChange("r", e.target.value)}
                placeholder={t("Current value", "toolbar.currentValue")}
                className="h-8 min-w-0 font-mono text-xs placeholder:opacity-30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                N <span className="opacity-60">(max iter)</span>
              </Label>
              <Input
                value={params.N}
                onChange={(e) => handleParamChange("N", e.target.value)}
                placeholder={t("Current value", "toolbar.currentValue")}
                className="h-8 min-w-0 font-mono text-xs placeholder:opacity-30"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={!canJump} onClick={handleJump}>
            {t("Jump", "toolbar.jump")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

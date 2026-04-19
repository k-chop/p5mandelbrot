import { setSerializedPalette } from "@/camera/palette";
import { POI_THUMBNAIL_SIZE } from "@/constants";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import { setCurrentParams, setManualN } from "@/mandelbrot-state/mandelbrot-state";
import { requestCanvasImage } from "@/p5-adapter/p5-adapter";
import { useStoreValue } from "@/store/store";
import type { MandelbrotWorkerType } from "@/types";
import BigNumber from "bignumber.js";
import { useCallback, useEffect, useRef, useState } from "react";

/** バッチ生成に渡す1件分のジャンプ先情報 */
export interface ThumbnailTarget {
  id: string;
  x: string;
  y: string;
  r: string;
  N: number;
  mode: MandelbrotWorkerType;
  palette?: string;
}

/** バッチ生成の状態 */
export type BatchState =
  | { status: "idle" }
  | { status: "running"; current: number; total: number; currentId: string }
  | { status: "done"; generated: number };

/**
 * サムネイル一括生成フック
 *
 * ジャンプ→描画完了待ち→キャプチャを繰り返し、
 * 各サムネイルをonCaptureコールバックで返す。
 */
export const useThumbnailBatch = (onCapture: (id: string, dataUrl: string) => Promise<void>) => {
  const [batchState, setBatchState] = useState<BatchState>({ status: "idle" });
  const progress = useStoreValue("progress");

  const queueRef = useRef<ThumbnailTarget[]>([]);
  const indexRef = useRef(0);
  const waitingForRenderRef = useRef(false);
  const generatedRef = useRef(0);
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  /** キュー内の次のターゲットを処理する */
  const processNext = useCallback(() => {
    const queue = queueRef.current;
    const index = indexRef.current;

    if (index >= queue.length) {
      setBatchState({ status: "done", generated: generatedRef.current });
      return;
    }

    const target = queue[index];
    setBatchState({
      status: "running",
      current: index + 1,
      total: queue.length,
      currentId: target.id,
    });

    setManualN(target.N);
    setCurrentParams({
      x: new BigNumber(target.x),
      y: new BigNumber(target.y),
      r: new BigNumber(target.r),
      N: target.N,
      mode: target.mode,
    });
    clearIterationCache();
    setSerializedPalette(target.palette);

    waitingForRenderRef.current = true;
  }, []);

  /** 描画完了を検知してキャプチャ→次へ進む */
  useEffect(() => {
    if (!waitingForRenderRef.current) return;
    if (typeof progress === "string") return;

    // 描画完了: 次のフレームでキャプチャ
    waitingForRenderRef.current = false;
    const currentTarget = queueRef.current[indexRef.current];

    requestCanvasImage(POI_THUMBNAIL_SIZE, (dataUrl) => {
      void onCaptureRef.current(currentTarget.id, dataUrl).then(() => {
        generatedRef.current += 1;
        indexRef.current += 1;
        processNext();
      });
    });
  }, [progress, processNext]);

  /** バッチ生成を開始する */
  const start = useCallback(
    (targets: ThumbnailTarget[]) => {
      if (targets.length === 0) {
        setBatchState({ status: "done", generated: 0 });
        return;
      }
      queueRef.current = targets;
      indexRef.current = 0;
      generatedRef.current = 0;
      processNext();
    },
    [processNext],
  );

  return { batchState, start };
};

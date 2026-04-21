import { getStore } from "@/store/store";
import type p5 from "p5";
import {
  changeDraggingState,
  changeToMousePressedState,
  changeToMouseReleasedState,
  confirmPinchGesture,
  p5MouseReleased,
  startPinchGesture,
  updatePinchGesture,
  zoomTo,
} from "./p5-adapter";
import { isOnUIOverlay } from "./utils";

/** タップかドラッグかを判定するしきい値 (px) */
const TAP_MOVE_THRESHOLD_PX = 10;

/** ピンチ開始時の2本指間距離 (ピクセル) */
let pinchStartDistance: number | null = null;
/** 1本指タッチの開始位置 (タップ/ドラッグ判定用) */
let singleTouchStart: { x: number; y: number } | null = null;
/** 1本指タッチがしきい値を超えて移動したか */
let singleTouchMoved = false;
/**
 * canvas向けのgesture処理中かどうか
 *
 * p5はtouchイベントをwindowにバインドするため、UI要素上のタッチでも
 * 本ハンドラが呼ばれる。touchStartedでUI判定してgesture開始をスキップした
 * 場合、後続のtouchMoved/touchEndedでもfalse返却でpreventDefaultしないよう
 * このフラグで識別する (= UI上のタップで synthesized click が潰れるのを防ぐ)。
 */
let gestureActive = false;

/**
 * 2本指のclient座標間距離を計算
 */
const pinchDistance = (ev: TouchEvent): number => {
  const t0 = ev.touches[0];
  const t1 = ev.touches[1];
  return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
};

/**
 * p5のmouseX/mouseYをタッチ座標で上書きする
 *
 * p5のドラッグ計算 (getDraggingPixelDiff等) はp.mouseX/mouseYを参照するため、
 * 既存のmouse系ロジックに乗せるためタッチ座標で同期する。
 */
const syncP5MousePos = (p: p5, x: number, y: number): void => {
  (p as unknown as { mouseX: number; mouseY: number }).mouseX = x;
  (p as unknown as { mouseX: number; mouseY: number }).mouseY = y;
};

/**
 * p5のp.touches配列からcanvasローカル座標を取り出す
 */
const getCanvasLocalTouch = (p: p5, index: number): { x: number; y: number } | null => {
  const touches = p.touches as { x: number; y: number }[] | undefined;
  if (!touches || touches.length <= index) return null;
  return { x: touches[index].x, y: touches[index].y };
};

/**
 * p.touchStartedに設定するハンドラ
 *
 * falseを返すことでp5の touch→mouse 合成を抑制し、p.mousePressed の発火を防ぐ。
 * UI要素上のタッチはfalseを返さずブラウザ/UIに任せる。
 */
export const onP5TouchStarted = (p: p5, ev: TouchEvent | undefined): boolean => {
  if (!ev) return true;
  if (isOnUIOverlay(ev as unknown as MouseEvent)) return true;
  if (getStore("canvasLocked")) return false;

  gestureActive = true;

  if (ev.touches.length >= 2) {
    pinchStartDistance = pinchDistance(ev);
    startPinchGesture(p);
  } else if (ev.touches.length === 1) {
    const pos = getCanvasLocalTouch(p, 0);
    if (pos) {
      singleTouchStart = pos;
      singleTouchMoved = false;
      syncP5MousePos(p, pos.x, pos.y);
      changeToMousePressedState(p);
    }
  }

  return false;
};

/**
 * p.touchMovedに設定するハンドラ
 */
export const onP5TouchMoved = (p: p5, ev: TouchEvent | undefined): boolean => {
  if (!ev) return true;
  if (!gestureActive) return true;
  if (getStore("canvasLocked")) return false;

  if (pinchStartDistance !== null && ev.touches.length >= 2) {
    const d = pinchDistance(ev);
    updatePinchGesture(d / pinchStartDistance);
    return false;
  }

  if (ev.touches.length === 1 && pinchStartDistance === null) {
    const pos = getCanvasLocalTouch(p, 0);
    if (pos) {
      if (singleTouchStart) {
        const dx = pos.x - singleTouchStart.x;
        const dy = pos.y - singleTouchStart.y;
        if (!singleTouchMoved && Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX) {
          singleTouchMoved = true;
        }
      }
      syncP5MousePos(p, pos.x, pos.y);
      if (singleTouchMoved) {
        changeDraggingState("move", p);
      }
    }
  }

  return false;
};

/**
 * p.touchEndedに設定するハンドラ
 */
export const onP5TouchEnded = (p: p5, ev: TouchEvent | undefined): boolean => {
  if (!ev) return true;
  if (!gestureActive) return true;
  if (getStore("canvasLocked")) return false;

  if (pinchStartDistance !== null) {
    confirmPinchGesture(p);
    pinchStartDistance = null;
    singleTouchStart = null;
    singleTouchMoved = false;
    if (ev.touches.length === 0) gestureActive = false;
    return false;
  }

  if (ev.touches.length === 0) {
    if (singleTouchMoved) {
      // スワイプ確定 → 既存mouseReleasedでmoveTo
      p5MouseReleased(p, new MouseEvent("mouseup"));
    } else {
      // タップ → 画面中央を基準にズームイン (タップ位置では動かさない)
      zoomTo(false);
      changeToMouseReleasedState();
    }
    singleTouchStart = null;
    singleTouchMoved = false;
    gestureActive = false;
  }

  return false;
};

/**
 * canvasにtouch-action: noneを適用してブラウザ標準のピンチズーム/スクロールを抑止する
 */
export const disableCanvasTouchAction = (canvas: HTMLCanvasElement): void => {
  canvas.style.touchAction = "none";
};

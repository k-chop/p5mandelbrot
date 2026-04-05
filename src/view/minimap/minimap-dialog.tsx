import { setSerializedPalette } from "@/camera/palette";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import { setCurrentParams, setManualN } from "@/mandelbrot-state/mandelbrot-state";
import {
  type PresetPOIRaw,
  getPresetPOIList,
  getPresetThumbnailUrl,
} from "@/preset-poi/preset-poi";
import { calcCoordPrecision } from "@/math/coord-precision";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { loadPreview } from "@/store/preview-store";
import { useStoreValue } from "@/store/store";
import type { POIData } from "@/types";
import BigNumber from "bignumber.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** ミニマップの表示サイズ(px) */
const DISPLAY_SIZE = 1024;

/** ミニマップの複素平面パラメータ */
const MAP_CENTER_X = -0.75;
const MAP_CENTER_Y = 0;
const MAP_R = 1.5;

/** クラスタリングの距離閾値(px) */
const CLUSTER_RADIUS = 20;

/** ピンの色 */
const PRESET_COLOR = "#3b82f6";
const USER_POI_COLOR = "#f97316";

type MinimapDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** ピンのソース種別 */
type PinSource = "preset" | "user";

/** 個別ピンのデータ */
type Pin = {
  x: number;
  y: number;
  source: PinSource;
  id: string;
  label: string;
  thumbnailUrl: string | null;
  jumpAction: () => void;
};

/** クラスタリングされたピン群 */
type Cluster = {
  cx: number;
  cy: number;
  pins: Pin[];
};

/**
 * 複素座標をミニマップのピクセル座標に変換する
 */
const complexToPixel = (re: number, im: number): { x: number; y: number } => {
  const rangeX = MAP_R * 2;
  const rangeY = MAP_R * 2;
  const x = ((re - (MAP_CENTER_X - MAP_R)) / rangeX) * DISPLAY_SIZE;
  const y = ((MAP_CENTER_Y + MAP_R - im) / rangeY) * DISPLAY_SIZE;
  return { x, y };
};

/**
 * ピンを貪欲法でクラスタリングする
 */
const clusterPins = (pins: Pin[]): Cluster[] => {
  const clusters: Cluster[] = [];

  for (const pin of pins) {
    let merged = false;
    for (const cluster of clusters) {
      const dx = pin.x - cluster.cx;
      const dy = pin.y - cluster.cy;
      if (dx * dx + dy * dy <= CLUSTER_RADIUS * CLUSTER_RADIUS) {
        cluster.pins.push(pin);
        // クラスタ中心を再計算
        cluster.cx = cluster.pins.reduce((sum, p) => sum + p.x, 0) / cluster.pins.length;
        cluster.cy = cluster.pins.reduce((sum, p) => sum + p.y, 0) / cluster.pins.length;
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({ cx: pin.x, cy: pin.y, pins: [pin] });
    }
  }

  return clusters;
};

/**
 * プリセットPOIにジャンプする
 */
const jumpToPreset = (poi: PresetPOIRaw) => {
  setManualN(poi.N);
  setCurrentParams({
    x: new BigNumber(poi.x),
    y: new BigNumber(poi.y),
    r: new BigNumber(poi.r),
    N: poi.N,
    mode: poi.mode,
  });
  clearIterationCache();
  setSerializedPalette(poi.palette);
};

/**
 * ユーザーPOIにジャンプする
 */
const jumpToUserPOI = (poi: POIData) => {
  setManualN(poi.N);
  setCurrentParams({
    x: poi.x,
    y: poi.y,
    r: poi.r,
    N: poi.N,
    mode: poi.mode,
  });
  clearIterationCache();
  setSerializedPalette(poi.serializedPalette);
};

/** ポップオーバーの幅(px) */
const POPOVER_WIDTH = 280;

/**
 * ピンの位置に応じてポップオーバーの配置を決定する
 *
 * 端に近い場合は逆方向に表示し、はみ出しを防ぐ。
 */
const popoverPosition = (cx: number, cy: number): React.CSSProperties => {
  const style: React.CSSProperties = {};

  // 縦方向: 上端に近ければ下に、それ以外は上に表示
  if (cy < 120) {
    style.top = "100%";
    style.marginTop = 8;
  } else {
    style.bottom = "100%";
    style.marginBottom = 8;
  }

  // 横方向: 左端/右端に近ければ寄せる、それ以外は中央
  if (cx < POPOVER_WIDTH / 2 + 16) {
    style.left = 0;
  } else if (cx > DISPLAY_SIZE - POPOVER_WIDTH / 2 - 16) {
    style.right = 0;
  } else {
    style.left = "50%";
    style.transform = "translateX(-50%)";
  }

  return style;
};

/**
 * クラスタのホバーポップオーバー
 */
const ClusterPopover = ({ cluster, onJump }: { cluster: Cluster; onJump: () => void }) => {
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result: Record<string, string | null> = {};
      for (const pin of cluster.pins) {
        if (pin.source === "user") {
          const preview = await loadPreview(pin.id);
          if (cancelled) return;
          result[pin.id] = (preview as string) ?? null;
        } else {
          result[pin.id] = pin.thumbnailUrl;
        }
      }
      setThumbnails(result);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [cluster.pins]);

  return (
    <div className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto">
      {cluster.pins.map((pin) => (
        <button
          key={pin.id}
          className="overflow-hidden rounded transition-opacity hover:opacity-80"
          style={{
            border: `2px solid ${pin.source === "preset" ? PRESET_COLOR : USER_POI_COLOR}`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            pin.jumpAction();
            onJump();
          }}
        >
          <div className="aspect-square w-full bg-black/40">
            {thumbnails[pin.id] && (
              <img src={thumbnails[pin.id]!} alt={pin.label} className="size-full object-cover" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

/**
 * ミニマップ上のピン（またはクラスタ）を描画するコンポーネント
 */
const ClusterPin = ({ cluster, onJump }: { cluster: Cluster; onJump: () => void }) => {
  const [showPopover, setShowPopover] = useState(false);
  const pinRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const isSingle = cluster.pins.length === 1;
  const hasMixed = !isSingle && new Set(cluster.pins.map((p) => p.source)).size > 1;
  const primaryColor = hasMixed
    ? "#a855f7"
    : cluster.pins[0].source === "preset"
      ? PRESET_COLOR
      : USER_POI_COLOR;

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowPopover(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowPopover(false);
    }, 200);
  };

  return (
    <div
      ref={pinRef}
      className="absolute"
      style={{
        left: cluster.cx,
        top: cluster.cy,
        transform: "translate(-50%, -50%)",
        zIndex: showPopover ? 50 : 10,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ピン本体 */}
      <div
        className="flex items-center justify-center rounded-full border-2 border-white/80 shadow-lg shadow-black/50 transition-transform hover:scale-125"
        style={{
          backgroundColor: primaryColor,
          width: isSingle ? 14 : 22,
          height: isSingle ? 14 : 22,
          cursor: "pointer",
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (isSingle) {
            cluster.pins[0].jumpAction();
            onJump();
          }
        }}
      >
        {!isSingle && (
          <span className="text-[10px] font-bold text-white">{cluster.pins.length}</span>
        )}
      </div>

      {/* ポップオーバー */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute z-50 w-70 rounded-lg border border-white/10 bg-[#1e1e2e]/95 p-2 shadow-xl backdrop-blur-sm"
          style={popoverPosition(cluster.cx, cluster.cy)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <ClusterPopover cluster={cluster} onJump={onJump} />
        </div>
      )}
    </div>
  );
};

/**
 * マンデルブロ集合のミニマップを表示するダイアログ
 *
 * 全体表示のマンデルブロ集合画像上にプリセットとユーザーPOIの位置をピンで表示する。
 * 近接するピンはクラスタリングされ、ホバーでサムネイル一覧を表示する。
 */
export const MinimapDialog = ({ open, onOpenChange }: MinimapDialogProps) => {
  const userPOIList: POIData[] = useStoreValue("poi");

  const { clusters, presetCount, userCount } = useMemo(() => {
    const presetList = getPresetPOIList();

    const pins: Pin[] = [];

    // ユーザーPOIと重複するプリセットIDを収集（ユーザーPOI優先で表示するため）
    const duplicatePresetIds = new Set<string>();
    for (const userPOI of userPOIList) {
      const precision = calcCoordPrecision(userPOI.r);
      const ux = userPOI.x.toPrecision(precision);
      const uy = userPOI.y.toPrecision(precision);
      const ur = userPOI.r.toString();
      for (const preset of presetList) {
        const px = new BigNumber(preset.x).toPrecision(precision);
        const py = new BigNumber(preset.y).toPrecision(precision);
        if (px === ux && py === uy && preset.r === ur && preset.N === userPOI.N) {
          duplicatePresetIds.add(preset.id);
        }
      }
    }

    // プリセットPOI（ユーザーPOIと重複するものはスキップ）
    for (const poi of presetList) {
      if (duplicatePresetIds.has(poi.id)) continue;
      const re = Number(poi.x);
      const im = Number(poi.y);
      const { x, y } = complexToPixel(re, im);
      // 表示範囲外はスキップ
      if (x < 0 || x > DISPLAY_SIZE || y < 0 || y > DISPLAY_SIZE) continue;
      pins.push({
        x,
        y,
        source: "preset",
        id: poi.id,
        label: `#${poi.id} N:${poi.N}`,
        thumbnailUrl: getPresetThumbnailUrl(poi.id),
        jumpAction: () => jumpToPreset(poi),
      });
    }

    // ユーザーPOI
    for (const poi of userPOIList) {
      const re = poi.x.toNumber();
      const im = poi.y.toNumber();
      const { x, y } = complexToPixel(re, im);
      if (x < 0 || x > DISPLAY_SIZE || y < 0 || y > DISPLAY_SIZE) continue;
      pins.push({
        x,
        y,
        source: "user",
        id: poi.id,
        label: `#${poi.id.slice(0, 6)} N:${poi.N}`,
        thumbnailUrl: null,
        jumpAction: () => jumpToUserPOI(poi),
      });
    }

    return {
      clusters: clusterPins(pins),
      presetCount: presetList.length - duplicatePresetIds.size,
      userCount: userPOIList.length,
    };
  }, [userPOIList]);

  const handleJump = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-fit p-4">
        <DialogHeader>
          <DialogTitle>Minimap</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span
              className="inline-block size-3 rounded-full border border-white/60"
              style={{ backgroundColor: PRESET_COLOR }}
            />
            Preset ({presetCount})
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block size-3 rounded-full border border-white/60"
              style={{ backgroundColor: USER_POI_COLOR }}
            />
            My POI ({userCount})
          </span>
        </div>
        <div
          className="relative overflow-hidden rounded border border-[#2a2a3a]"
          style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
        >
          <img
            src={`${import.meta.env.BASE_URL ?? "/"}minimap.png`}
            alt="Mandelbrot set minimap"
            className="block"
            style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
            draggable={false}
          />
          {clusters.map((cluster, i) => (
            <ClusterPin key={i} cluster={cluster} onJump={handleJump} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

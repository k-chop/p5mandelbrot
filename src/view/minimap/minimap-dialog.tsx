import { setSerializedPalette } from "@/camera/palette";
import { clearIterationCache } from "@/iteration-buffer/iteration-buffer";
import { setCurrentParams, setManualN } from "@/mandelbrot-state/mandelbrot-state";
import {
  type PresetPOIRaw,
  getPresetThumbnailUrl,
  isSamePOI,
  usePresetPOIList,
} from "@/preset-poi/preset-poi";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shadcn/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/components/ui/popover";
import { loadPreview } from "@/store/preview-store";
import { updateStore, useStoreValue } from "@/store/store";
import type { POIData } from "@/types";
import BigNumber from "bignumber.js";
import { useCallback, useEffect, useMemo, useState } from "react";

/** ミニマップの最大表示サイズ(px) */
const MAX_DISPLAY_SIZE = 1024;

/** ミニマップの複素平面パラメータ */
const MAP_CENTER_X = -0.75;
const MAP_CENTER_Y = 0;
const MAP_R = 1.5;

/** クラスタリングの距離閾値 (% — ミニマップサイズに対する割合) */
const CLUSTER_RADIUS_PERCENT = 2;

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
 * 複素座標をミニマップ上の% (0-100) に変換する
 */
const complexToPercent = (re: number, im: number): { x: number; y: number } => {
  const rangeX = MAP_R * 2;
  const rangeY = MAP_R * 2;
  const x = ((re - (MAP_CENTER_X - MAP_R)) / rangeX) * 100;
  const y = ((MAP_CENTER_Y + MAP_R - im) / rangeY) * 100;
  return { x, y };
};

/**
 * ピンを貪欲法でクラスタリングする (%単位)
 */
const clusterPins = (pins: Pin[]): Cluster[] => {
  const clusters: Cluster[] = [];
  const r = CLUSTER_RADIUS_PERCENT;

  for (const pin of pins) {
    let merged = false;
    for (const cluster of clusters) {
      const dx = pin.x - cluster.cx;
      const dy = pin.y - cluster.cy;
      if (dx * dx + dy * dy <= r * r) {
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

/**
 * クラスタのサムネイル一覧 (Popover中身)
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
    <div
      className="grid max-h-72 gap-1.5 overflow-y-auto overscroll-contain"
      style={{
        gridTemplateColumns: `repeat(${Math.min(cluster.pins.length, 3)}, 80px)`,
        touchAction: "pan-y",
      }}
    >
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
              <img
                crossOrigin="anonymous"
                src={thumbnails[pin.id]!}
                alt={pin.label}
                className="size-full object-cover"
              />
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

/**
 * ミニマップ上のピン（またはクラスタ）を描画するコンポーネント
 *
 * 複数ピンのクラスタ: タップで Radix Popover (portal) が開いてサムネイル一覧表示。
 * 単一ピン: タップで直接ジャンプ。
 */
const ClusterPin = ({ cluster, onJump }: { cluster: Cluster; onJump: () => void }) => {
  const [open, setOpen] = useState(false);

  const isSingle = cluster.pins.length === 1;
  const hasMixed = !isSingle && new Set(cluster.pins.map((p) => p.source)).size > 1;
  const primaryColor = hasMixed
    ? "#a855f7"
    : cluster.pins[0].source === "preset"
      ? PRESET_COLOR
      : USER_POI_COLOR;

  const handleJumpAndClose = () => {
    setOpen(false);
    onJump();
  };

  const pinEl = (
    <div
      className="absolute"
      style={{
        left: `${cluster.cx}%`,
        top: `${cluster.cy}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full border-2 border-white/80 shadow-lg shadow-black/50 transition-transform hover:scale-125"
        style={{
          backgroundColor: primaryColor,
          width: isSingle ? 18 : 26,
          height: isSingle ? 18 : 26,
          cursor: "pointer",
        }}
        onClick={(e) => {
          if (isSingle) {
            e.stopPropagation();
            cluster.pins[0].jumpAction();
            onJump();
          }
        }}
      >
        {!isSingle && (
          <span className="text-[11px] font-bold text-white">{cluster.pins.length}</span>
        )}
      </div>
    </div>
  );

  if (isSingle) return pinEl;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{pinEl}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        collisionPadding={16}
        className="w-fit max-w-[min(92vw,360px)] p-2"
      >
        <ClusterPopover cluster={cluster} onJump={handleJumpAndClose} />
      </PopoverContent>
    </Popover>
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
  const presetList = usePresetPOIList();

  const { clusters, presetCount, userCount } = useMemo(() => {
    const pins: Pin[] = [];

    // ユーザーPOIと重複するプリセットIDを収集（ユーザーPOI優先で表示するため）
    const duplicatePresetIds = new Set<string>();
    for (const userPOI of userPOIList) {
      for (const preset of presetList) {
        if (isSamePOI(userPOI, preset)) {
          duplicatePresetIds.add(preset.id);
        }
      }
    }

    // プリセットPOI（ユーザーPOIと重複するものはスキップ）
    for (const poi of presetList) {
      if (duplicatePresetIds.has(poi.id)) continue;
      const re = Number(poi.x);
      const im = Number(poi.y);
      const { x, y } = complexToPercent(re, im);
      // 表示範囲外はスキップ
      if (x < 0 || x > 100 || y < 0 || y > 100) continue;
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
      const { x, y } = complexToPercent(re, im);
      if (x < 0 || x > 100 || y < 0 || y > 100) continue;
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
  }, [userPOIList, presetList]);

  const handleJump = useCallback(() => {
    onOpenChange(false);
    // 選択結果をキャンバスでしっかり見せるためPOI drawerも閉じる
    updateStore("poiDrawerSnap", "closed");
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[95vh] w-[calc(100vw-2rem)] max-w-[1056px] flex-col p-4"
        aria-describedby={undefined}
      >
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
        {/* ミニマップをスクロール可能なコンテナに入れる。中身は固定サイズなので小さいviewportではパンして閲覧 */}
        <div className="min-h-0 flex-1 overflow-auto rounded border border-[#2a2a3a]">
          <div
            className="relative aspect-square"
            style={{ width: MAX_DISPLAY_SIZE, maxWidth: "none" }}
          >
            <img
              src={`${import.meta.env.BASE_URL ?? "/"}minimap.png`}
              alt="Mandelbrot set minimap"
              className="block size-full"
              draggable={false}
            />
            {clusters.map((cluster, i) => (
              <ClusterPin key={i} cluster={cluster} onJump={handleJump} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

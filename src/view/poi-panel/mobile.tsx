import { useT } from "@/i18n/context";
import { cloneCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { getCanvasSize } from "@/rendering/renderer";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/shadcn/components/ui/drawer";
import { updateStore, useStoreValue } from "@/store/store";
import { IconCirclePlus } from "@tabler/icons-react";
import { VisuallyHidden } from "radix-ui";
import { POICardPreview } from "../right-sidebar/poi-card-preview";
import { usePOI } from "../right-sidebar/use-poi";
import { PanelContent, POIPanelHeader } from "./index";
import { usePOIScrollRef, useScrollSaver } from "./poi-scroll-context";

/**
 * vaul snapPoints: 完全非表示 / 横ストリップ (追加ボタン+サムネイル1行) / フル
 *
 * closedは `"0px"` にする必要がある (`0` は vaul の useEffect 内の truthy check で
 * 弾かれて activeSnapPoint の変化に反応しない)。
 */
const SNAP_CLOSED = "0px";
const SNAP_SMALL = "240px";
const SNAP_FULL = 1;
const SNAP_POINTS = [SNAP_CLOSED, SNAP_SMALL, SNAP_FULL] as const;

/**
 * vaulのsnap値 (`0` | `"240px"` | `1`) をstoreの `poiDrawerSnap` 値に変換する
 */
const snapValueToState = (v: number | string | null): "closed" | "small" | "full" | null => {
  if (v === SNAP_CLOSED) return "closed";
  if (v === SNAP_SMALL) return "small";
  if (v === SNAP_FULL) return "full";
  return null;
};

/**
 * 小モード: 追加ボタン + POIサムネイルの横スクロールストリップ
 *
 * PC版の閉じているときのCollapsedStripを横倒しにしたイメージ。
 * サムネイルは "natural" アスペクトで表示する (モバイルはcanvasが非正方形のため)。
 */
const POIPanelSmallContent = () => {
  const t = useT();
  const { poiList, addPOI, applyPOI } = usePOI();
  const ref = usePOIScrollRef("mobileSmall");
  const { setScrollContainer, handleScroll } = useScrollSaver(ref, "horizontal");

  // 現在のcanvasアスペクトに合わせてSaveボタンを縦長にする (モバイルは縦長canvas想定)
  // 初期化前はcanvasSizeが0/0でNaNになるので正方形(=1)にフォールバック
  const canvasSize = getCanvasSize();
  const rawAspect = canvasSize.width / canvasSize.height;
  const saveButtonAspect = Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 1;

  return (
    <div
      ref={setScrollContainer}
      onScroll={handleScroll}
      className="flex h-[180px] items-center gap-2 overflow-x-auto px-3"
    >
      <button
        type="button"
        onClick={() => addPOI(cloneCurrentParams())}
        style={{ aspectRatio: saveButtonAspect }}
        className="flex h-full shrink-0 flex-col items-center justify-center gap-1 rounded bg-primary/90 px-2 text-primary-foreground transition-colors hover:bg-primary"
      >
        <IconCirclePlus size={28} />
        <span className="text-xs">{t("Save POI")}</span>
      </button>
      {poiList.map((poi) => (
        <button
          type="button"
          key={poi.id}
          onClick={() => applyPOI(poi)}
          className="flex h-full shrink-0 items-center justify-center overflow-hidden rounded transition-opacity hover:opacity-80"
        >
          <POICardPreview poi={poi} aspect="natural" />
        </button>
      ))}
    </div>
  );
};

/**
 * モバイル時のPOI BottomSheet
 *
 * 3状態スナップ (closed / small / full)。
 * storeの `poiDrawerSnap` と vaul の activeSnapPoint を双方向同期する。
 */
export const POIPanelMobile = () => {
  const t = useT();
  const snap = useStoreValue("poiDrawerSnap");
  const activeSnapPoint =
    snap === "closed" ? SNAP_CLOSED : snap === "small" ? SNAP_SMALL : SNAP_FULL;

  const handleSnapChange = (value: number | string | null) => {
    const next = snapValueToState(value);
    if (next) updateStore("poiDrawerSnap", next);
  };

  return (
    <Drawer
      open
      dismissible={false}
      modal={false}
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={handleSnapChange}
    >
      <DrawerContent className="h-[100dvh] bg-[#161620]/97 pb-4 backdrop-blur-sm data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[100dvh]">
        <VisuallyHidden.Root>
          <DrawerTitle>Points of Interest</DrawerTitle>
          <DrawerDescription>
            {t("Saved Points of Interest", "dialog.description.poiPanel")}
          </DrawerDescription>
        </VisuallyHidden.Root>
        {snap === "full" ? (
          <>
            <POIPanelHeader />
            <div className="flex min-h-0 grow flex-col overflow-y-auto px-2 pt-2">
              <PanelContent />
            </div>
          </>
        ) : (
          <>
            {/* ドラッグハンドル掴みやすいように上部の非スクロールゾーンを大きく取る */}
            <div className="h-6 shrink-0" />
            <POIPanelSmallContent />
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

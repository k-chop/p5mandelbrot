import { useT } from "@/i18n/context";
import { cloneCurrentParams } from "@/mandelbrot-state/mandelbrot-state";
import { Drawer, DrawerContent, DrawerTitle } from "@/shadcn/components/ui/drawer";
import { updateStore, useStoreValue } from "@/store/store";
import { IconCirclePlus } from "@tabler/icons-react";
import { VisuallyHidden } from "radix-ui";
import { POICardPreview } from "../right-sidebar/poi-card-preview";
import { usePOI } from "../right-sidebar/use-poi";
import { PanelContent, POIPanelHeader } from "./index";

/** vaul snapPoints: 完全非表示 / 横ストリップ (追加ボタン+サムネイル1行) / フル */
const SNAP_CLOSED = 0;
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

  return (
    <div className="mt-auto flex h-[200px] items-center gap-2 overflow-x-auto px-3 pb-2">
      <button
        type="button"
        onClick={() => addPOI(cloneCurrentParams())}
        className="flex aspect-square h-full shrink-0 flex-col items-center justify-center gap-1 rounded bg-primary/90 px-2 text-primary-foreground transition-colors hover:bg-primary"
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
        </VisuallyHidden.Root>
        {snap === "full" ? (
          <>
            <POIPanelHeader />
            <div className="flex min-h-0 grow flex-col overflow-y-auto px-2 pt-2">
              <PanelContent />
            </div>
          </>
        ) : (
          <POIPanelSmallContent />
        )}
      </DrawerContent>
    </Drawer>
  );
};

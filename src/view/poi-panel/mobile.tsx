import { Drawer, DrawerContent, DrawerTitle } from "@/shadcn/components/ui/drawer";
import { updateStore, useStoreValue } from "@/store/store";
import { VisuallyHidden } from "radix-ui";
import { PanelContent, POIPanelHeader } from "./index";

/** モバイル時のスナップ位置 (ピーク / フル) */
const SNAP_POINTS = [0.15, 1] as const;

/** モバイル時のPOI BottomSheet (2段階スナップ) */
export const POIPanelMobile = () => {
  const poiPanelOpen = useStoreValue("poiPanelOpen");
  const activeSnapPoint = poiPanelOpen ? SNAP_POINTS[1] : SNAP_POINTS[0];

  const handleSnapChange = (snap: number | string | null) => {
    if (snap === SNAP_POINTS[1]) {
      updateStore("poiPanelOpen", true);
    } else if (snap === SNAP_POINTS[0]) {
      updateStore("poiPanelOpen", false);
    }
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
      <DrawerContent className="bg-[#161620]/97 backdrop-blur-sm">
        <VisuallyHidden.Root>
          <DrawerTitle>Points of Interest</DrawerTitle>
        </VisuallyHidden.Root>
        <POIPanelHeader />
        <div className="flex min-h-0 grow flex-col overflow-y-auto px-2 pt-2">
          <PanelContent />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

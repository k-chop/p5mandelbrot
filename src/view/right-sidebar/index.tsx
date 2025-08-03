import { useStoreValue } from "@/store/store";
import { DebugMode } from "./debug-mode/debug-mode";
import { Informations } from "./informations";
import { Operations } from "./operations";
import { POIHistories } from "./poi-histories";

export const RightSidebar = () => {
  const isDebugMode = useStoreValue("isDebugMode");

  return (
    <div className="flex h-full flex-col gap-2">
      {isDebugMode ? (
        <DebugMode />
      ) : (
        <>
          {/* <Parameters /> */}
          <Informations />
          <Operations />
          <POIHistories />
        </>
      )}
    </div>
  );
};

import { LoadingSpinner } from "@/components/loading-spinner";
import { useStoreValue } from "@/store/store";

export const CanvasOverlay = () => {
  const progress = useStoreValue("progress");

  return (
    <div className="size-[800px] p-1">
      {typeof progress === "string" && <LoadingSpinner />}
    </div>
  );
};

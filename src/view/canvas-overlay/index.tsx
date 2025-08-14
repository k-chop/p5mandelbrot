import { LoadingSpinner } from "@/components/loading-spinner";
import { useStoreValue } from "@/store/store";

export const CanvasOverlay = () => {
  const progress = useStoreValue("progress");

  const showSpinner = typeof progress === "string" && progress !== "";

  return <div className="p-1">{showSpinner && <LoadingSpinner />}</div>;
};

import { Informations } from "./informations";
import { Operations } from "./operations";
import { Parameters } from "./parameters";
import { POIHistories } from "./poi-histories";

export const RightSidebar = () => {
  return (
    <div className="flex h-full flex-col gap-2">
      <Parameters />
      <Informations />
      <Operations />
      <POIHistories />
    </div>
  );
};

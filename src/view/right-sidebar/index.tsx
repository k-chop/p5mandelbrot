import { Operations } from "./operations";
import { Parameters } from "./parameters";

export const RightSidebar = () => {
  return (
    <div className="grid gap-2">
      <Parameters />
      <Operations />
    </div>
  );
};

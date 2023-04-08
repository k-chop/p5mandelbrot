import { RightSidebar } from "./right-sidebar";
import ReactDOM from "react-dom";

export const AppRoot = () => {
  return (
    <>
      {ReactDOM.createPortal(
        <RightSidebar />,
        document.getElementById("sidebar-right")!
      )}
    </>
  );
};

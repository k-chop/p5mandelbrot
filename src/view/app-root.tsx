import ReactDOM from "react-dom";
import { Footer } from "./footer";
import { Header } from "./header";
import { RightSidebar } from "./right-sidebar";

export const AppRoot = () => {
  return (
    <>
      {ReactDOM.createPortal(<Header />, document.getElementById("header")!)}
      {ReactDOM.createPortal(
        <RightSidebar />,
        document.getElementById("sidebar-right")!,
      )}
      {ReactDOM.createPortal(<Footer />, document.getElementById("footer")!)}
    </>
  );
};

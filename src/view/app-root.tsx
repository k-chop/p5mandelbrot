import { Footer } from "./footer";
import { Header } from "./header";
import { RightSidebar } from "./right-sidebar";
import ReactDOM from "react-dom";

export const AppRoot = () => {
  return (
    <>
      {ReactDOM.createPortal(<Header />, document.getElementById("header")!)}
      {ReactDOM.createPortal(
        <RightSidebar />,
        document.getElementById("sidebar-right")!
      )}
      {ReactDOM.createPortal(<Footer />, document.getElementById("footer")!)}
    </>
  );
};

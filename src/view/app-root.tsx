import { Toaster } from "@/components/ui/toaster";
import ReactDOM from "react-dom";
import { CanvasOverlay } from "./canvas-overlay";
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
      {ReactDOM.createPortal(
        <CanvasOverlay />,
        document.getElementById("canvas-overlay")!,
      )}
      <Toaster />
    </>
  );
};

import { useRef } from "react"

export const SupersamplingOverlay = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  return (<div className="h-full w-full">
    <canvas id="supersampling-canvas" ref={canvasRef} />
  </div>)
}
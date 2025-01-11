import { Kbd } from "@/components/kbd";

export const Instructions = () => {
  return (
    <div>
      <div className="mb-2 border-b text-lg font-bold">Mouse</div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div>Wheel</div>
        <div>Zoom</div>

        <div>Click</div>
        <div>Zoom at clicked point</div>

        <div>LMB Drag</div>
        <div>Change center</div>

        <div>RMB Drag</div>
        <div>Interactive zoom and change center</div>
      </div>

      <div className="mb-2 border-b text-lg font-bold">Keys</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
        </div>
        <div>Zoom</div>

        <div>
          <Kbd>1</Kbd>
          <Kbd>2</Kbd>
          <Kbd>3</Kbd>
          <Kbd>4</Kbd>
          <Kbd>5</Kbd>
          <Kbd>6</Kbd>
          <Kbd>7</Kbd>
          <Kbd>8</Kbd>
        </div>
        <div>Change Palette</div>

        <div>
          <Kbd>m</Kbd>
        </div>
        <div>Toggle mode</div>

        <div>
          <Kbd>r</Kbd>
        </div>
        <div>Reset r to 2.0</div>

        <div>
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </div>
        <div>Change max iteration (±100)</div>

        <div>
          <Kbd>Shift</Kbd> + <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </div>
        <div>Change max iteration wisely (maybe)</div>

        <div>
          <Kbd>9</Kbd>
        </div>
        <div>Reset iteration count to 10000</div>

        <div>
          <Kbd>0</Kbd>
        </div>
        <div>Reset iteration count to 500</div>
      </div>
    </div>
  );
};

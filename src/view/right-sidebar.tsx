import { useStoreValue } from "../store/store";

export const RightSidebar = () => {
  return (
    <>
      <Parameters />
      <Descriptions />
    </>
  );
};

const Parameters = () => {
  const centerX = useStoreValue("centerX");
  const centerY = useStoreValue("centerY");
  const mouseX = useStoreValue("mouseX");
  const mouseY = useStoreValue("mouseY");
  const r = useStoreValue("r");
  const N = useStoreValue("N");
  const iteration = useStoreValue("iteration");
  const mode = useStoreValue("mode");

  return (
    <div className="description">
      <ul>
        <li>centerX: {centerX}</li>
        <li>centerY: {centerY}</li>
        <li>mouseX: {mouseX}</li>
        <li>mouseY: {mouseY}</li>
        <li>r: {r}</li>
        <li>N: {N}</li>
        <li>iteration: {iteration}</li>
        <li>mode: {mode}</li>
      </ul>
    </div>
  );
};

const Descriptions = () => {
  return (
    <ul className="description">
      <li>Mouse</li>
      <li>- Wheel: Zoom</li>
      <li>- Shift + Wheel: Change center & Zoom</li>
      <li>- Click: Change center</li>
      <li>Key</li>
      <li>- ↑↓: Zoom</li>
      <li>- 1,2,3: Change color scheme</li>
      <li>- m: Toggle float precision (64bit, 128bit)</li>
      <li>- r: Reset r to 2.0</li>
      <li>- ←→: Change max iteration (±100)</li>
      <li>- Shift + ←→: Change max iteration wisely (maybe)</li>
      <li>- 9: Reset iteration count to 10000</li>
      <li>- 0: Reset iteration count to 500</li>
    </ul>
  );
};

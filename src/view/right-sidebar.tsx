export const RightSidebar = () => {
  return (
    <>
      <Parameters />
      <Descriptions />
    </>
  );
};

const Parameters = () => {
  return <div className="description">ここにパラメータが入る</div>;
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
      <li>- ←→: Change iteration count (±100)</li>
      <li>- Shift + ←→: Change iteration count wisely (maybe)</li>
      <li>- 9: Reset iteration count to 10000</li>
      <li>- 0: Reset iteration count to 500</li>
    </ul>
  );
};

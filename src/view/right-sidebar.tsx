import { Flex } from "@mantine/core";
import { useStoreValue } from "../store/store";

export const RightSidebar = () => {
  return (
    <Flex w="100%">
      <Parameters />
    </Flex>
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

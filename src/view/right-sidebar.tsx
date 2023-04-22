import { Container, Flex, Table, Text } from "@mantine/core";
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
    <Table ml="1rem">
      <tr>
        <td>centerX</td>
        <td>
          <Text align="right">{centerX}</Text>
        </td>
      </tr>
      <tr>
        <td>centerY</td>
        <td>
          <Text align="right">{centerY}</Text>
        </td>
      </tr>
      <tr>
        <td>mouseX</td>
        <td>
          <Text align="right">{mouseX}</Text>
        </td>
      </tr>
      <tr>
        <td>mouseY</td>
        <td>
          <Text align="right">{mouseY}</Text>
        </td>
      </tr>
      <tr>
        <td>r</td>
        <td>
          <Text align="right">{r}</Text>
        </td>
      </tr>
      <tr>
        <td>N</td>
        <td>
          <Text align="right">{N}</Text>
        </td>
      </tr>
      <tr>
        <td>iteration</td>
        <td>
          <Text align="right">{iteration}</Text>
        </td>
      </tr>
      <tr>
        <td>mode</td>
        <td>
          <Text align="right">{mode}</Text>
        </td>
      </tr>
    </Table>
  );
};

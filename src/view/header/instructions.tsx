import { Table, Title, Kbd } from "@mantine/core";

export const Instructions = () => {
  return (
    <div>
      <Title order={3}>Mouse</Title>
      <Table ml="1rem">
        <tr>
          <td>Wheel</td>
          <td>Zoom</td>
        </tr>
        <tr>
          <td>Shift + Wheel</td>
          <td>Change center & Zoom</td>
        </tr>
        <tr>
          <td>Click</td>
          <td>Change center</td>
        </tr>
      </Table>
      <Title order={3}>Key</Title>
      <Table ml="1rem">
        <tr>
          <td>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </td>
          <td>Zoom</td>
        </tr>
        <tr>
          <td>
            <Kbd>1</Kbd>, <Kbd>2</Kbd>, <Kbd>3</Kbd>
          </td>
          <td>Change color scheme</td>
        </tr>
        <tr>
          <td>
            <Kbd>m</Kbd>
          </td>
          <td>Toggle mode</td>
        </tr>
        <tr>
          <td>
            <Kbd>r</Kbd>
          </td>
          <td>Reset r to 2.0</td>
        </tr>
        <tr>
          <td>
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
          </td>
          <td>Change max iteration (±100)</td>
        </tr>
        <tr>
          <td>
            <Kbd>Shift</Kbd> + <Kbd>←</Kbd>
            <Kbd>→</Kbd>
          </td>
          <td>Change max iteration wisely (maybe)</td>
        </tr>
        <tr>
          <td>
            <Kbd>9</Kbd>
          </td>
          <td>Reset iteration count to 10000</td>
        </tr>
        <tr>
          <td>
            <Kbd>0</Kbd>
          </td>
          <td>Reset iteration count to 500</td>
        </tr>
      </Table>
    </div>
  );
};

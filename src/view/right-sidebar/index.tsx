import { Stack } from "@mantine/core";
import { Operations } from "./operations";
import { Parameters } from "./parameters";

export const RightSidebar = () => {
  return (
    <Stack>
      <Parameters />
      <Operations />
    </Stack>
  );
};

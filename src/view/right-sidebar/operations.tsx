import { Tabs } from "@mantine/core";
import { POI } from "./poi";

export const Operations = () => {
  return (
    <Tabs mx="md" w="100%" defaultValue="poi">
      <Tabs.List grow>
        <Tabs.Tab value="poi">POI</Tabs.Tab>
        <Tabs.Tab value="palette" disabled>
          Palette
        </Tabs.Tab>
        <Tabs.Tab value="other" disabled>
          Other
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="poi" pt="xs">
        <POI />
      </Tabs.Panel>
    </Tabs>
  );
};

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POI } from "./poi";
import { Settings } from "./settings";

export const Operations = () => {
  return (
    <Tabs className="mx-2" defaultValue="poi">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="poi">POI</TabsTrigger>
        <TabsTrigger value="palette" disabled>
          Palette
        </TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="poi">
        <POI />
      </TabsContent>
      <TabsContent value="settings">
        <Settings />
      </TabsContent>
    </Tabs>
  );
};

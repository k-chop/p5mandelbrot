import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shadcn/components/ui/tabs";
import { updateStore, useStoreValue } from "@/store/store";
import { BatchRenderViewer } from "./batch-render-viewer";
import { EventViewer } from "./event-viewer";
import { InterestingPointsViewer } from "./interesting-points-viewer";

export const DebugMode = () => {
  const debugModeTab = useStoreValue("debugModeTab");

  return (
    <Tabs value={debugModeTab} onValueChange={(v) => updateStore("debugModeTab", v)}>
      <TabsList>
        <TabsTrigger value="batch-render">Batch Render</TabsTrigger>
        <TabsTrigger value="event-viewer">Event Viewer</TabsTrigger>
        <TabsTrigger value="ip-debug">Interesting Points</TabsTrigger>
      </TabsList>
      <TabsContent value="batch-render">
        <BatchRenderViewer />
      </TabsContent>
      <TabsContent value="event-viewer">
        <EventViewer />
      </TabsContent>
      <TabsContent value="ip-debug">
        <InterestingPointsViewer />
      </TabsContent>
    </Tabs>
  );
};

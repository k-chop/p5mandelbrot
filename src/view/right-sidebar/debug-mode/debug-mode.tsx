import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shadcn/components/ui/tabs";
import { BatchRenderViewer } from "./batch-render-viewer";
import { EventViewer } from "./event-viewer";

export const DebugMode = () => {
  return (
    <Tabs defaultValue="batch-render">
      <TabsList>
        <TabsTrigger value="batch-render">Batch Render</TabsTrigger>
        <TabsTrigger value="event-viewer">Event Viewer</TabsTrigger>
      </TabsList>
      <TabsContent value="batch-render">
        <BatchRenderViewer />
      </TabsContent>
      <TabsContent value="event-viewer">
        <EventViewer />
      </TabsContent>
    </Tabs>
  );
};

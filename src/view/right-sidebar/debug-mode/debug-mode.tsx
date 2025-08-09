import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shadcn/components/ui/tabs";
import { EventViewer } from "./event-viewer";
import { IterationCacheViewer } from "./iteration-cache-viewer";

export const DebugMode = () => {
  return (
    <Tabs defaultValue="iteration-cache">
      <TabsList>
        <TabsTrigger value="iteration-cache">Iteration Cache</TabsTrigger>
        <TabsTrigger value="event-viewer">Event Viewer</TabsTrigger>
      </TabsList>
      <TabsContent value="iteration-cache">
        <IterationCacheViewer />
      </TabsContent>
      <TabsContent value="event-viewer">
        <EventViewer />
      </TabsContent>
    </Tabs>
  );
};

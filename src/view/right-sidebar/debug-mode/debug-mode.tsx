import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shadcn/components/ui/tabs";
import { IterationCacheViewer } from "./iteration-cache-viewer";
import { EventViewer } from "./event-viewer";

export const DebugMode = () => {
  return (
    <Tabs defaultValue="iteration-cache">
      <TabsList>
        <TabsTrigger value="iteration-cache">Iteration Cache</TabsTrigger>
        <TabsTrigger value="worker-stats">Event Viewer</TabsTrigger>
      </TabsList>
      <TabsContent value="iteration-cache">
        <IterationCacheViewer />
      </TabsContent>
      <TabsContent value="worker-stats">
        <EventViewer />
      </TabsContent>
    </Tabs>
  );
};

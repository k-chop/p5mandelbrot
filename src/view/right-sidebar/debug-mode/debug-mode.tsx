import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shadcn/components/ui/tabs";
import { IterationCacheViewer } from "./iteration-cache-viewer";

export const DebugMode = () => {
  return (
    <Tabs defaultValue="iteration-cache">
      <TabsList>
        <TabsTrigger value="iteration-cache">Iteration Cache</TabsTrigger>
        <TabsTrigger value="worker-stats">Worker Stats</TabsTrigger>
      </TabsList>
      <TabsContent value="iteration-cache">
        <IterationCacheViewer />
      </TabsContent>
      <TabsContent value="worker-stats">
        <div>hello</div>
      </TabsContent>
    </Tabs>
  );
};

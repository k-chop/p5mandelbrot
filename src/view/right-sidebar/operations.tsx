import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POI } from "./poi";
import { Settings } from "./settings";
import { isGithubPages } from "@/lib/location";
import { Button } from "@/components/ui/button";
import { IconCircleCheck, IconCopy } from "@tabler/icons-react";
import { usePOI } from "./use-poi";
import { useToast } from "@/components/ui/use-toast";

export const Operations = () => {
  if (isGithubPages()) {
    return <SuggestRedirect />;
  }

  return (
    <Tabs className="mx-2 flex flex-grow flex-col" defaultValue="poi">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="poi">POI</TabsTrigger>
        <TabsTrigger value="palette" disabled>
          Palette
        </TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent
        className="flex h-full flex-grow flex-col data-[state=inactive]:hidden"
        value="poi"
      >
        <POI />
      </TabsContent>
      <TabsContent
        className="flex h-full flex-grow flex-col data-[state=inactive]:hidden"
        value="settings"
      >
        <Settings />
      </TabsContent>
    </Tabs>
  );
};

const SuggestRedirect = () => {
  const { copyPOIListToClipboard } = usePOI();
  const { toast } = useToast();

  return (
    <div className="px-3">
      <div className="text-lg font-bold">This is outdated app.</div>
      <div className="py-2">
        Please visit{" "}
        <a
          href="https://p5mandelbrot.pages.dev"
          className="text-primary hover:underline"
        >
          https://p5mandelbrot.pages.dev
        </a>{" "}
        to use new app.
      </div>
      <div className="py-2">
        If you wish to export/import the POI list, use this button.
      </div>
      <div className="py-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            copyPOIListToClipboard();

            toast({
              description: (
                <div className="flex items-center justify-center gap-2">
                  <IconCircleCheck />
                  POI List JSON copied to clipboard!
                </div>
              ),
              variant: "primary",
              duration: 2000,
            });
          }}
        >
          <IconCopy className="mr-2" />
          Copy POI List to clipboard
        </Button>
      </div>
    </div>
  );
};

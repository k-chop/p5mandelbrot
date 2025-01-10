import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { isGithubPages } from "@/lib/location";
import { IconCircleCheck, IconCopy } from "@tabler/icons-react";
import { PaletteEditor } from "./palette-editor";
import { POI } from "./poi";
import { Settings } from "./settings";
import { usePOI } from "./use-poi";

const tabsContentClass =
  "flex h-full flex-grow flex-col data-[state=inactive]:hidden";

export const Operations = () => {
  if (isGithubPages()) {
    return <SuggestRedirect />;
  }

  return (
    <Tabs className="mx-2 flex grow flex-col" defaultValue="poi">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="poi">POI</TabsTrigger>
        <TabsTrigger value="palette">Palette</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent className={tabsContentClass} value="poi">
        <POI />
      </TabsContent>
      <TabsContent className={tabsContentClass} value="palette">
        <PaletteEditor />
      </TabsContent>
      <TabsContent className={tabsContentClass} value="settings">
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

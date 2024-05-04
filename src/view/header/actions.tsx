import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { copyCurrentParamsToClipboard } from "@/lib/params";
import { IconCircleCheck, IconShare } from "@tabler/icons-react";

export const Actions = () => {
  return (
    <div>
      <ShareButton />
    </div>
  );
};

const ShareButton = () => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        copyCurrentParamsToClipboard();

        toast({
          description: (
            <div className="flex items-center justify-center gap-2">
              <IconCircleCheck />
              Current location URL copied to clipboard!
            </div>
          ),
          variant: "primary",
          duration: 2000,
        });
      }}
    >
      <IconShare className="mr-1 h-6 w-6" />
      Share
    </Button>
  );
};

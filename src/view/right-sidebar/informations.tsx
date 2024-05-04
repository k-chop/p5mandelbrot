import { Kbd } from "@/components/kbd";
import { Card, CardContent } from "@/components/ui/card";
import { useStoreValue } from "@/store/store";
import { IconPin } from "@tabler/icons-react";

export const Informations = () => {
  const isReferencePinned = useStoreValue("isReferencePinned");

  if (!isReferencePinned) return null;

  return (
    <Card className="mx-2">
      <CardContent className="p-0 px-2 pt-1">
        {isReferencePinned && (
          <div className="flex flex-col gap-1">
            <div className="flex">
              <IconPin /> Reference Orbit Pinned
            </div>
            <div>
              (Press <Kbd>p</Kbd> to unpin)
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

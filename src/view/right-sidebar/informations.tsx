import { Kbd } from "@/components/kbd";
import { useT } from "@/i18n/context";
import { Card, CardContent } from "@/shadcn/components/ui/card";
import { useStoreValue } from "@/store/store";
import { IconPin } from "@tabler/icons-react";

export const Informations = () => {
  const t = useT();
  const shouldReuseRefOrbit = useStoreValue("shouldReuseRefOrbit");

  if (!shouldReuseRefOrbit) return null;

  return (
    <Card className="mx-2">
      <CardContent className="p-0 px-2 pt-1">
        {shouldReuseRefOrbit && (
          <div className="flex flex-col gap-1">
            <div className="flex">
              <IconPin /> {t("Reference Orbit Pinned")}
            </div>
            <div>
              ({t("Press", "info.pressToUnpin")} <Kbd>p</Kbd> {t("to unpin", "info.pressToUnpinSuffix")})
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

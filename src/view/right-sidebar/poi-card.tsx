import { IconArrowBigLeftLine, IconTrash } from "@tabler/icons-react";
import { MandelbrotParams } from "../../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type POICardProps = {
  poi: MandelbrotParams;
  onDelete: () => void;
  onApply: () => void;
};

export const POICard = ({ poi, onDelete, onApply }: POICardProps) => {
  const { r, N } = poi;

  // TODO: できればbackgroundImageで画像のプレビューを表示したい

  return (
    <Card className="p-2">
      <div className="flex justify-between">
        <div>r</div>
        <div>{r.toPrecision(10)}</div>
      </div>
      <div className="flex justify-between">
        <div>N</div>
        <div>{N.toFixed(0)}</div>
      </div>
      <div className="mt-2 flex justify-between">
        <Button variant="default" size="icon" onClick={onApply}>
          <IconArrowBigLeftLine />
        </Button>
        <Button variant="destructive" size="icon" onClick={onDelete}>
          <IconTrash />
        </Button>
      </div>
    </Card>
  );
};

import { loadPreview } from "@/store/preview-store";
import usePromise from "react-promise-suspense";

type Props = {
  poiId: string;
};

export const POICardPreview = ({ poiId }: Props) => {
  const data = usePromise(loadPreview, [poiId]);

  if (data == null)
    return (
      <div className="flex h-[100px] w-[100px] items-center justify-center border-2">
        No Image
      </div>
    );

  return <img src={data} />;
};

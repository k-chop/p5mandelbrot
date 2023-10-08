import { useStoreValue } from "../../store/store";

export const Footer = () => {
  // TODO: debounceした方がいいかも
  const progress = useStoreValue("progress");

  return <>{progress}</>;
};

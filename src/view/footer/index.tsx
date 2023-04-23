import { useStoreValue } from "../../store/store";

export const Footer = () => {
  // TODO: debounceした方がいいかも
  const progress = useStoreValue("progress");
  const millis = useStoreValue("millis");

  if (progress !== "100") {
    return <>Generating... {progress}%</>;
  }

  return <>Done! time: {millis}ms</>;
};

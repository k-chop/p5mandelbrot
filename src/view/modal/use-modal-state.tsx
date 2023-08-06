import { useDisclosure } from "@mantine/hooks";
import { updateStore } from "../../store/store";

export const useModalState = (): ReturnType<typeof useDisclosure> => {
  const [opened, callbacks] = useDisclosure(false, {
    onOpen: () => {
      updateStore("canvasLocked", true);
    },
    onClose: () => {
      setTimeout(() => updateStore("canvasLocked", false), 100);
    },
  });

  return [opened, callbacks];
};

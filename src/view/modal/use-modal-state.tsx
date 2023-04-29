import { useDisclosure } from "@mantine/hooks";
import { updateStore } from "../../store/store";

export const useModalState = (): ReturnType<typeof useDisclosure> => {
  const [opened, callbacks] = useDisclosure(false, {
    onOpen: () => {
      updateStore("canvasLocked", true);
    },
    onClose: () => {
      updateStore("canvasLocked", false);
    },
  });

  return [opened, callbacks];
};

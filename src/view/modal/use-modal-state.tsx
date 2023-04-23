import { useDisclosure } from "@mantine/hooks";
import { updateStore } from "../../store/store";

export const useModalState = (): ReturnType<typeof useDisclosure> => {
  const [opened, callbacks] = useDisclosure(false, {
    onOpen: () => {
      updateStore("modalOpened", true);
    },
    onClose: () => {
      updateStore("modalOpened", false);
    },
  });

  return [opened, callbacks];
};

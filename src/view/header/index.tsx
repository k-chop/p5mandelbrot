import { ActionIcon, Flex, Grid, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconHelp } from "@tabler/icons-react";
import { Instructions } from "./instructions";

export const Header = () => {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Modal opened={opened} onClose={close} title="Instructions" centered>
        <Instructions />
      </Modal>
      <Grid>
        <Grid.Col span={10}>
          <Flex h="100%" align={"center"}>
            Header
          </Flex>
        </Grid.Col>
        <Grid.Col span={2}>
          <Flex justify={"flex-end"}>
            <ActionIcon size="md" radius="md" variant="filled" onClick={open}>
              <IconHelp size="2.125rem" />
            </ActionIcon>
          </Flex>
        </Grid.Col>
      </Grid>
    </>
  );
};

import { changePaletteById, palettePresets } from "@/camera/palette";
import { getStore, useStoreValue } from "@/store/store";
import { useEffect, useState } from "react";

export const usePaletteSelection = () => {
  const [selectedId, setSelectedId] = useState(() => getStore("paletteId"));

  const paletteId = useStoreValue("paletteId");
  useEffect(() => {
    setSelectedId(paletteId);
  }, [paletteId]);

  const handlePaletteChange = (id: string) => {
    changePaletteById(id);
    setSelectedId(id);
  };

  const paletteOptions = palettePresets.map((palette) => ({
    value: palette.getId(),
    label: palette.getDisplayName(),
  }));

  return {
    selectedId,
    paletteOptions,
    handlePaletteChange,
  };
};

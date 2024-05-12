import { Palette } from ".";
import { ChromaJsPalette } from "./color-chromajs";
import { D3ChromaticPalette } from "./color-d3-chromatic";

export const deserializePalette = (serialized: string): Palette => {
  const [type] = serialized.split(",");

  switch (type) {
    case "chroma-js":
      return ChromaJsPalette.deserialize(serialized);
    case "d3-chromatic":
      return D3ChromaticPalette.deserialize(serialized);
    default:
      throw new Error(`Unknown palette type: ${type}`);
  }
};

import VitalsHeader from "../parts/VitalsHeader/part.js";
import WardwatchStage from "../parts/WardwatchStage/part.js";
import EssenceFooter from "../parts/EssenceFooter/part.js";

export function createPartRegistry() {
  const map = new Map([
    ["VitalsHeader", VitalsHeader],
    ["WardwatchStage", WardwatchStage],
    ["EssenceFooter", EssenceFooter],
  ]);

  return {
    get(id){
      const part = map.get(id);
      if (!part) throw new Error(`Unknown part: ${id}`);
      return part;
    }
  };
}

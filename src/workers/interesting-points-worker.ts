/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { findInterestingPoints } from "@/interesting-points/find-interesting-points";
import type {
  InterestingPointsComputeRequest,
  InterestingPointsComputeResponse,
} from "./interesting-points-worker-protocol";

self.addEventListener("message", (event: MessageEvent<InterestingPointsComputeRequest>) => {
  const { requestId, buffer, width, height, maxIteration, debug } = event.data;
  const iterationBuffer = new Uint32Array(buffer);

  if (debug) {
    const result = findInterestingPoints(iterationBuffer, width, height, maxIteration, {
      debug: true,
    });
    const response: InterestingPointsComputeResponse = {
      type: "result",
      requestId,
      points: result.points,
      debugData: result.debugData,
    };
    self.postMessage(response);
  } else {
    const points = findInterestingPoints(iterationBuffer, width, height, maxIteration);
    const response: InterestingPointsComputeResponse = {
      type: "result",
      requestId,
      points,
      debugData: null,
    };
    self.postMessage(response);
  }
});

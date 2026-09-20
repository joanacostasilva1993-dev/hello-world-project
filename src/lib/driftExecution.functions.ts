import { z } from "zod";
import type { DriftMcpExecutionPlan } from "./driftExecutor.functions";
import { createDriftBridgeJob, type LocalBridgeJob } from "./localBridge.functions";

export const driftExecutionSnapshotSchema = z.object({
  plan: z.unknown(),
  job: z.unknown(),
});

export type DriftExecutionSnapshot = {
  plan: DriftMcpExecutionPlan;
  job: LocalBridgeJob;
};

export function createDriftExecutionSnapshot(plan: DriftMcpExecutionPlan): DriftExecutionSnapshot {
  return {
    plan,
    job: createDriftBridgeJob(plan),
  };
}

export function saveDriftExecutionSnapshot(snapshot: DriftExecutionSnapshot): void {
  localStorage.setItem("viralflow.driftExecution", JSON.stringify(snapshot));
}

export function loadDriftExecutionSnapshot(): DriftExecutionSnapshot | null {
  const raw = localStorage.getItem("viralflow.driftExecution");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DriftExecutionSnapshot;
    return parsed;
  } catch {
    return null;
  }
}

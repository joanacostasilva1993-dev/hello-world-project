import { z } from "zod";
import type { DriftMcpExecutionPlan } from "./driftExecutor.functions";

export const localBridgeJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "partial",
  "failed",
  "cancelled",
]);

export const localBridgeJobSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.literal("drift-execution"),
  status: localBridgeJobStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  planVersion: z.literal(1),
  projectId: z.string().min(1).max(120),
  title: z.string().max(300),
  currentStep: z.number().int().nonnegative(),
  totalSteps: z.number().int().nonnegative(),
  error: z.string().max(2000).optional(),
});

export type LocalBridgeJob = z.infer<typeof localBridgeJobSchema>;

export const localBridgeCommandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("health") }),
  z.object({ command: z.literal("start"), plan: z.unknown() }),
  z.object({ command: z.literal("status"), jobId: z.string().min(1).max(120) }),
  z.object({ command: z.literal("cancel"), jobId: z.string().min(1).max(120) }),
]);

export type LocalBridgeCommand = z.infer<typeof localBridgeCommandSchema>;

export const localBridgeResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("health"),
    bridgeVersion: z.string(),
    driftConnected: z.boolean(),
    capabilities: z.array(z.string()),
  }),
  z.object({
    type: z.literal("job"),
    job: localBridgeJobSchema,
  }),
  z.object({
    type: z.literal("error"),
    code: z.string(),
    message: z.string(),
  }),
]);

export type LocalBridgeResponse = z.infer<typeof localBridgeResponseSchema>;

export function createDriftBridgeJob(plan: DriftMcpExecutionPlan): LocalBridgeJob {
  const now = new Date().toISOString();

  return localBridgeJobSchema.parse({
    id: `drift-job-${Date.now()}`,
    type: "drift-execution",
    status: "queued",
    createdAt: now,
    updatedAt: now,
    planVersion: plan.version,
    projectId: plan.projectId,
    title: plan.title,
    currentStep: 0,
    totalSteps: plan.steps.length,
  });
}

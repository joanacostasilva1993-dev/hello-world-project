import { z } from "zod";

export const entityIdSchema = z.string().min(1).max(160);
export const timestampSchema = z.string().datetime();

export const contentStatusSchema = z.enum([
  "draft",
  "processing",
  "ready",
  "published",
  "archived",
]);

export const projectSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1).max(200),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  status: contentStatusSchema,
  version: z.literal(1),
});

export const contentProjectSchema = z.object({
  project: projectSchema,
  ideaId: entityIdSchema.optional(),
  hookId: entityIdSchema.optional(),
  scriptId: entityIdSchema.optional(),
  storyboardId: entityIdSchema.optional(),
  timelineId: entityIdSchema.optional(),
});

export type Project = z.infer<typeof projectSchema>;
export type ContentProject = z.infer<typeof contentProjectSchema>;

export const eventTypeSchema = z.enum([
  "PROJECT_CREATED",
  "RESEARCH_SOURCE_RESOLVED",
  "RESEARCH_COMPLETED",
  "IDEA_CREATED",
  "HOOK_READY",
  "SCRIPT_READY",
  "STORYBOARD_READY",
  "ASSETS_READY",
  "TIMELINE_READY",
  "DRIFT_EXECUTION_STARTED",
  "DRIFT_EXECUTION_COMPLETED",
  "EXPORT_COMPLETED",
  "PUBLISHED",
  "METRICS_RECEIVED",
  "LEARNING_UPDATED",
  "WORKFLOW_STARTED",
  "WORKFLOW_NODE_STARTED",
  "WORKFLOW_NODE_COMPLETED",
  "WORKFLOW_BLOCKED",
  "WORKFLOW_FAILED",
  "WORKFLOW_COMPLETED",
]);

export const viralFlowEventSchema = z.object({
  id: entityIdSchema,
  type: eventTypeSchema,
  version: z.literal(1),
  occurredAt: timestampSchema,
  projectId: entityIdSchema,
  source: z.string().min(1).max(120),
  payload: z.record(z.unknown()),
});

export type ViralFlowEvent = z.infer<typeof viralFlowEventSchema>;

export function createEvent(
  type: z.infer<typeof eventTypeSchema>,
  projectId: string,
  source: string,
  payload: Record<string, unknown> = {},
): ViralFlowEvent {
  return viralFlowEventSchema.parse({
    id: `evt-${crypto.randomUUID()}`,
    type,
    version: 1,
    occurredAt: new Date().toISOString(),
    projectId,
    source,
    payload,
  });
}

export const providerSelectionSchema = z.object({
  capability: z.string().min(1).max(100),
  preferredProviderId: z.string().min(1).max(100).optional(),
  excludedProviderIds: z.array(z.string().min(1).max(100)).max(30).default([]),
  execution: z.enum(["cloud", "local", "hybrid"]).default("hybrid"),
  maxCostTier: z.enum(["free", "low", "medium", "high"]).default("low"),
});

export type ProviderSelection = z.infer<typeof providerSelectionSchema>;

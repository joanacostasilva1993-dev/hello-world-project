import { z } from "zod";

import { entityIdSchema, type ViralFlowEvent } from "./core.functions";
import {
  providerRouterDecisionSchema,
  resolveProvider,
  type ProviderRouterDecision,
} from "./providerRouter.functions";
import { contentQualityReportSchema, type ContentQualityReport } from "./quality.functions";

export const workflowNodeKindSchema = z.enum([
  "trigger",
  "intelligence",
  "generation",
  "transform",
  "media",
  "quality",
  "timeline",
  "export",
  "publish",
]);

export const workflowNodeTypeSchema = z.enum([
  "project.input",
  "research.run",
  "originality.check",
  "idea.generate",
  "hook.generate",
  "script.generate",
  "storyboard.generate",
  "media.search",
  "asset.generate",
  "quality.check",
  "policy.check",
  "packaging.validate",
  "timeline.build",
  "timeline.validate",
  "drift.execute",
  "export.video",
  "publish.content",
  "metrics.collect",
  "learning.update",
]);

export const workflowNodeSchema = z.object({
  id: entityIdSchema,
  type: workflowNodeTypeSchema,
  kind: workflowNodeKindSchema,
  label: z.string().min(1).max(160),
  capability: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).default({}),
});

export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const workflowEdgeSchema = z.object({
  id: entityIdSchema,
  from: entityIdSchema,
  to: entityIdSchema,
});

export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;

export const workflowSchema = z.object({
  id: entityIdSchema,
  version: z.literal(1),
  name: z.string().min(1).max(200),
  nodes: z.array(workflowNodeSchema).min(1).max(200),
  edges: z.array(workflowEdgeSchema).max(500),
});

export type Workflow = z.infer<typeof workflowSchema>;

export const workflowRunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "partial",
  "failed",
  "blocked",
  "cancelled",
]);

export const workflowNodeRunSchema = z.object({
  nodeId: entityIdSchema,
  status: workflowRunStatusSchema,
  providerDecision: providerRouterDecisionSchema.optional(),
  qualityReport: contentQualityReportSchema.optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  error: z.string().max(2000).optional(),
});

export const workflowRunSchema = z.object({
  id: entityIdSchema,
  workflowId: entityIdSchema,
  projectId: entityIdSchema,
  status: workflowRunStatusSchema,
  currentNodeId: entityIdSchema.optional(),
  nodeRuns: z.array(workflowNodeRunSchema),
  events: z.array(z.unknown()).max(500),
});

export type WorkflowRun = z.infer<typeof workflowRunSchema>;

export type WorkflowExecutionContext = {
  projectId: string;
  input: Record<string, unknown>;
  outputs: Record<string, unknown>;
  events: ViralFlowEvent[];
  quality?: ContentQualityReport;
};

const workflowNodeRequirements: Record<
  z.infer<typeof workflowNodeTypeSchema>,
  { capability?: string }
> = {
  "project.input": {},
  "research.run": { capability: "llm" },
  "originality.check": { capability: "llm" },
  "idea.generate": { capability: "llm" },
  "hook.generate": { capability: "llm" },
  "script.generate": { capability: "llm" },
  "storyboard.generate": { capability: "vision" },
  "media.search": { capability: "stock-search" },
  "asset.generate": { capability: "image-generation" },
  "quality.check": { capability: "llm" },
  "policy.check": { capability: "llm" },
  "packaging.validate": { capability: "llm" },
  "timeline.build": { capability: "timeline" },
  "timeline.validate": { capability: "timeline" },
  "drift.execute": { capability: "timeline" },
  "export.video": { capability: "render" },
  "publish.content": {},
  "metrics.collect": {},
  "learning.update": { capability: "llm" },
};

const qualityGateTypes = new Set<z.infer<typeof workflowNodeTypeSchema>>([
  "quality.check",
  "policy.check",
  "packaging.validate",
]);

function getNodeMap(workflow: Workflow) {
  return new Map(workflow.nodes.map((node) => [node.id, node]));
}

export function validateWorkflow(workflowInput: Workflow): Workflow {
  const workflow = workflowSchema.parse(workflowInput);
  const nodeMap = getNodeMap(workflow);
  const edgeIds = new Set<string>();

  for (const edge of workflow.edges) {
    if (edgeIds.has(edge.id)) throw new Error(`Workflow edge duplicada: ${edge.id}`);
    edgeIds.add(edge.id);
    if (edge.from === edge.to) throw new Error(`Workflow contém auto-loop no node ${edge.from}.`);
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      throw new Error(`Workflow contém edge inválida: ${edge.from} -> ${edge.to}.`);
    }
  }

  const incoming = new Map<string, number>(workflow.nodes.map((node) => [node.id, 0]));
  for (const edge of workflow.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  if (workflow.nodes.length > 1 && workflow.edges.length === 0) {
    throw new Error("Workflow com vários nodes precisa de pelo menos uma ligação.");
  }
  if (!workflow.nodes.some((node) => (incoming.get(node.id) ?? 0) === 0)) {
    throw new Error("Workflow inválido: não existe node de entrada.");
  }

  return workflow;
}

export function topologicalOrder(workflowInput: Workflow): WorkflowNode[] {
  const workflow = validateWorkflow(workflowInput);
  const nodeMap = getNodeMap(workflow);
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();

  for (const node of workflow.nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, 0);
  }
  for (const edge of workflow.edges) {
    outgoing.get(edge.from)?.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const queue = workflow.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const ordered: WorkflowNode[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) continue;
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    ordered.push(node);

    for (const nextId of outgoing.get(nodeId) ?? []) {
      const nextIncoming = (incoming.get(nextId) ?? 0) - 1;
      incoming.set(nextId, nextIncoming);
      if (nextIncoming === 0) queue.push(nextId);
    }
  }

  if (ordered.length !== workflow.nodes.length) {
    throw new Error("Workflow inválido: ciclo detectado no grafo.");
  }
  return ordered;
}

export function getNodeCapability(node: WorkflowNode): string | undefined {
  return node.capability ?? workflowNodeRequirements[node.type].capability;
}

export function isQualityGateNode(node: WorkflowNode): boolean {
  return qualityGateTypes.has(node.type);
}

export function resolveNodeProvider(
  node: WorkflowNode,
  options: {
    execution?: "cloud" | "local" | "hybrid";
    maxCostTier?: "free" | "low" | "medium" | "high";
    preferredProviderId?: string;
    excludedProviderIds?: string[];
  } = {},
): ProviderRouterDecision | undefined {
  const capability = getNodeCapability(node);
  if (!capability) return undefined;

  return resolveProvider(capability, {
    execution: options.execution ?? "hybrid",
    maxCostTier: options.maxCostTier ?? "low",
    ...(options.preferredProviderId ? { preferredProviderId: options.preferredProviderId } : {}),
    excludedProviderIds: options.excludedProviderIds ?? [],
  });
}

export function planWorkflow(
  workflowInput: Workflow,
  options: {
    execution?: "cloud" | "local" | "hybrid";
    maxCostTier?: "free" | "low" | "medium" | "high";
  } = {},
) {
  const workflow = validateWorkflow(workflowInput);
  return topologicalOrder(workflow).map((node) => ({
    node,
    provider: resolveNodeProvider(node, options),
    qualityGate: isQualityGateNode(node),
  }));
}

export function assertQualityGatePassed(
  reportInput: ContentQualityReport,
): ContentQualityReport {
  const report = contentQualityReportSchema.parse(reportInput);
  if (!report.overallPassed) {
    const blockers = Object.values(report)
      .filter((value): value is { score: number; blockers: string[]; warnings: string[] } =>
        typeof value === "object" && value !== null &&
        "score" in value && "blockers" in value && "warnings" in value,
      )
      .flatMap((dimension) => dimension.blockers);

    throw new Error(
      `Quality Gate bloqueado: ${blockers.slice(0, 5).join(" | ") || "conteúdo não aprovado"}`,
    );
  }
  return report;
}

export function createWorkflowRun(workflowInput: Workflow, projectId: string): WorkflowRun {
  const workflow = validateWorkflow(workflowInput);
  return workflowRunSchema.parse({
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workflowId: workflow.id,
    projectId,
    status: "queued",
    nodeRuns: workflow.nodes.map((node) => ({ nodeId: node.id, status: "queued" })),
    events: [],
  });
}

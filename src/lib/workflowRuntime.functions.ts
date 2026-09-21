import { z } from "zod";

import { createEvent } from "./core.functions";
import { createEventBus, type ViralFlowEventBus } from "./eventBus.functions";
import {
  assertQualityGatePassed,
  createWorkflowRun,
  isQualityGateNode,
  topologicalOrder,
  validateWorkflow,
  workflowRunSchema,
  type Workflow,
  type WorkflowExecutionContext,
  type WorkflowNode,
  type WorkflowRun,
} from "./workflow.functions";
import { contentQualityReportSchema } from "./quality.functions";

export const workflowNodeExecutionResultSchema = z.object({
  output: z.record(z.unknown()).default({}),
  qualityReport: contentQualityReportSchema.optional(),
  eventType: z
    .enum([
      "PROJECT_CREATED",
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
    ])
    .optional(),
  eventPayload: z.record(z.unknown()).default({}),
});

export type WorkflowNodeExecutionResult = z.infer<
  typeof workflowNodeExecutionResultSchema
>;

export type WorkflowNodeHandler = (
  node: WorkflowNode,
  context: WorkflowExecutionContext,
) => Promise<WorkflowNodeExecutionResult> | WorkflowNodeExecutionResult;

export type WorkflowRuntimeOptions = {
  handlers?: Partial<Record<WorkflowNode["type"], WorkflowNodeHandler>>;
  providerResolver?: (
    node: WorkflowNode,
  ) => WorkflowRun["nodeRuns"][number]["providerDecision"];
  eventBus?: ViralFlowEventBus;
};

const protectedNodeTypes = new Set<WorkflowNode["type"]>([
  "export.video",
  "publish.content",
]);

const requiredGateTypes = new Set<WorkflowNode["type"]>([
  "quality.check",
  "policy.check",
  "packaging.validate",
]);

function defaultHandler(node: WorkflowNode): WorkflowNodeExecutionResult {
  return {
    output: {
      nodeId: node.id,
      type: node.type,
      status: "executed",
      executionMode: "deterministic-stub",
    },
  };
}

function hasAllRequiredGates(passedGateTypes: Set<WorkflowNode["type"]>) {
  return [...requiredGateTypes].every((gate) => passedGateTypes.has(gate));
}

function guardProtectedNode(
  node: WorkflowNode,
  passedGateTypes: Set<WorkflowNode["type"]>,
) {
  if (!protectedNodeTypes.has(node.type)) return;

  if (!hasAllRequiredGates(passedGateTypes)) {
    const missing = [...requiredGateTypes].filter(
      (gate) => !passedGateTypes.has(gate),
    );
    throw new Error(
      `Node protegido bloqueado: ${node.type}. Gates em falta: ${missing.join(", ")}.`,
    );
  }
}

function publishRuntimeEvent(
  eventBus: ViralFlowEventBus,
  run: WorkflowRun,
  type: Parameters<typeof createEvent>[0],
  projectId: string,
  source: string,
  payload: Record<string, unknown>,
) {
  return eventBus.publish(
    createEvent(type, projectId, source, {
      workflowId: run.workflowId,
      runId: run.id,
      ...payload,
    }),
  );
}

export async function runWorkflow(
  workflowInput: Workflow,
  projectId: string,
  input: Record<string, unknown> = {},
  options: WorkflowRuntimeOptions = {},
): Promise<{ run: WorkflowRun; context: WorkflowExecutionContext }> {
  const workflow = validateWorkflow(workflowInput);
  const orderedNodes = topologicalOrder(workflow);
  const run = createWorkflowRun(workflow, projectId);
  const eventBus = options.eventBus ?? createEventBus();
  const context: WorkflowExecutionContext = {
    projectId,
    input,
    outputs: {},
    events: run.events,
  };
  const passedGateTypes = new Set<WorkflowNode["type"]>();

  run.status = "running";
  const started = publishRuntimeEvent(
    eventBus,
    run,
    "WORKFLOW_STARTED",
    projectId,
    "workflow-runtime",
    {},
  );
  context.events.push(started);

  try {
    for (const node of orderedNodes) {
      run.currentNodeId = node.id;
      const nodeRun = run.nodeRuns.find((item) => item.nodeId === node.id);
      if (!nodeRun) throw new Error(`Node run inexistente: ${node.id}`);

      nodeRun.status = "running";
      nodeRun.startedAt = new Date().toISOString();

      const nodeStarted = publishRuntimeEvent(
        eventBus,
        run,
        "WORKFLOW_NODE_STARTED",
        projectId,
        "workflow-runtime",
        { nodeId: node.id, nodeType: node.type },
      );
      context.events.push(nodeStarted);

      guardProtectedNode(node, passedGateTypes);

      if (options.providerResolver) {
        const providerDecision = options.providerResolver(node);
        if (providerDecision) nodeRun.providerDecision = providerDecision;
      }

      const handler =
        options.handlers?.[node.type] ??
        ((currentNode) => defaultHandler(currentNode));

      const result = workflowNodeExecutionResultSchema.parse(
        await handler(node, context),
      );

      if (isQualityGateNode(node)) {
        if (!result.qualityReport) {
          throw new Error(
            `Quality gate ${node.type} terminou sem qualityReport.`,
          );
        }

        const report = assertQualityGatePassed(result.qualityReport);
        nodeRun.qualityReport = report;
        context.quality = report;
        passedGateTypes.add(node.type);
      }

      context.outputs[node.id] = result.output;
      nodeRun.status = "completed";
      nodeRun.completedAt = new Date().toISOString();

      if (result.eventType) {
        const domainEvent = publishRuntimeEvent(
          eventBus,
          run,
          result.eventType,
          projectId,
          `workflow:${node.type}`,
          { nodeId: node.id, ...result.eventPayload },
        );
        context.events.push(domainEvent);
      }

      const nodeCompleted = publishRuntimeEvent(
        eventBus,
        run,
        "WORKFLOW_NODE_COMPLETED",
        projectId,
        "workflow-runtime",
        { nodeId: node.id, nodeType: node.type },
      );
      context.events.push(nodeCompleted);
    }

    run.status = "completed";
    run.currentNodeId = undefined;
    const completed = publishRuntimeEvent(
      eventBus,
      run,
      "WORKFLOW_COMPLETED",
      projectId,
      "workflow-runtime",
      {},
    );
    context.events.push(completed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";
    const currentNode = run.currentNodeId
      ? run.nodeRuns.find((item) => item.nodeId === run.currentNodeId)
      : undefined;

    if (currentNode?.status === "running") {
      const blocked =
        message.startsWith("Quality Gate") ||
        message.startsWith("Node protegido") ||
        message.startsWith("Quality gate");

      currentNode.status = blocked ? "blocked" : "failed";
      currentNode.completedAt = new Date().toISOString();
      currentNode.error = message;
    }

    run.status = currentNode?.status === "blocked" ? "blocked" : "failed";

    const failureEvent = publishRuntimeEvent(
      eventBus,
      run,
      run.status === "blocked" ? "WORKFLOW_BLOCKED" : "WORKFLOW_FAILED",
      projectId,
      "workflow-runtime",
      { nodeId: run.currentNodeId, error: message },
    );
    context.events.push(failureEvent);
  }

  return { run: workflowRunSchema.parse(run), context };
}

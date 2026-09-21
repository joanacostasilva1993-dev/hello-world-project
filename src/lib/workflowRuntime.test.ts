import { describe, expect, it } from "vitest";

import { createEvent, viralFlowEventSchema } from "./core.functions";
import { createEventBus } from "./eventBus.functions";
import {
  type Workflow,
  type WorkflowNode,
} from "./workflow.functions";
import { runWorkflow } from "./workflowRuntime.functions";
import type { ContentQualityReport } from "./quality.functions";

function node(
  id: string,
  type: WorkflowNode["type"],
  kind: WorkflowNode["kind"],
): WorkflowNode {
  return { id, type, kind, label: id, config: {} };
}

function workflow(nodes: WorkflowNode[], edges: [string, string][]): Workflow {
  return {
    id: "workflow-test",
    version: 1,
    name: "Workflow Test",
    nodes,
    edges: edges.map(([from, to], index) => ({
      id: `edge-${index}`,
      from,
      to,
    })),
  };
}

function qualityReport(overallPassed: boolean): ContentQualityReport {
  const dimension = {
    score: overallPassed ? 90 : 40,
    blockers: overallPassed ? [] : ["Teste bloqueador"],
    warnings: [],
  };

  return {
    originality: dimension,
    research: dimension,
    narrative: dimension,
    visual: dimension,
    valueDensity: dimension,
    repetition: dimension,
    policy: dimension,
    copyrightRisk: dimension,
    aiDisclosure: dimension,
    overallPassed,
    generatedAt: new Date().toISOString(),
  };
}

describe("Event Bus", () => {
  it("publishes, filters and retains bounded history", () => {
    const bus = createEventBus(2);
    const received: string[] = [];
    const unsubscribe = bus.subscribe(
      (event) => received.push(event.type),
      { projectId: "project-1" },
    );

    bus.publish(createEvent("PROJECT_CREATED", "project-1", "test"));
    bus.publish(createEvent("IDEA_CREATED", "project-2", "test"));
    bus.publish(createEvent("HOOK_READY", "project-1", "test"));

    expect(received).toEqual(["PROJECT_CREATED", "HOOK_READY"]);
    expect(bus.history()).toHaveLength(2);

    unsubscribe();
    bus.publish(createEvent("SCRIPT_READY", "project-1", "test"));
    expect(received).toHaveLength(2);
  });

  it("validates every event through the core contract", () => {
    const event = createEvent("WORKFLOW_STARTED", "project-1", "test");
    expect(viralFlowEventSchema.parse(event)).toEqual(event);
  });
});

describe("Workflow Runtime", () => {
  it("executes a valid workflow and emits lifecycle events", async () => {
    const bus = createEventBus();
    const result = await runWorkflow(
      workflow(
        [
          node("input", "project.input", "trigger"),
          node("idea", "idea.generate", "generation"),
        ],
        [["input", "idea"]],
      ),
      "project-1",
      {},
      { eventBus: bus },
    );

    expect(result.run.status).toBe("completed");
    expect(result.run.nodeRuns.every((run) => run.status === "completed")).toBe(true);
    expect(bus.history({ type: "WORKFLOW_COMPLETED" })).toHaveLength(1);
  });

  it("blocks export when required quality gates are missing", async () => {
    const bus = createEventBus();
    const result = await runWorkflow(
      workflow(
        [
          node("input", "project.input", "trigger"),
          node("export", "export.video", "export"),
        ],
        [["input", "export"]],
      ),
      "project-1",
      {},
      { eventBus: bus },
    );

    expect(result.run.status).toBe("blocked");
    expect(result.run.nodeRuns.find((run) => run.nodeId === "export")?.status).toBe(
      "blocked",
    );
    expect(bus.history({ type: "WORKFLOW_BLOCKED" })).toHaveLength(1);
  });

  it("blocks a failing quality gate and never reaches export", async () => {
    const nodes = [
      node("input", "project.input", "trigger"),
      node("quality", "quality.check", "quality"),
      node("policy", "policy.check", "quality"),
      node("packaging", "packaging.validate", "quality"),
      node("export", "export.video", "export"),
    ];
    const result = await runWorkflow(
      workflow(nodes, [
        ["input", "quality"],
        ["quality", "policy"],
        ["policy", "packaging"],
        ["packaging", "export"],
      ]),
      "project-1",
      {},
      {
        handlers: {
          "quality.check": () => ({ qualityReport: qualityReport(false) }),
        },
      },
    );

    expect(result.run.status).toBe("blocked");
    expect(result.run.nodeRuns.find((run) => run.nodeId === "quality")?.status).toBe(
      "blocked",
    );
    expect(result.run.nodeRuns.find((run) => run.nodeId === "export")?.status).toBe(
      "queued",
    );
  });

  it("allows export and publish only after all required gates pass", async () => {
    const nodes = [
      node("input", "project.input", "trigger"),
      node("quality", "quality.check", "quality"),
      node("policy", "policy.check", "quality"),
      node("packaging", "packaging.validate", "quality"),
      node("export", "export.video", "export"),
      node("publish", "publish.content", "publish"),
    ];

    const pass = () => ({ qualityReport: qualityReport(true) });
    const result = await runWorkflow(
      workflow(nodes, [
        ["input", "quality"],
        ["quality", "policy"],
        ["policy", "packaging"],
        ["packaging", "export"],
        ["export", "publish"],
      ]),
      "project-1",
      {},
      {
        handlers: {
          "quality.check": pass,
          "policy.check": pass,
          "packaging.validate": pass,
        },
      },
    );

    expect(result.run.status).toBe("completed");
    expect(result.run.nodeRuns.find((run) => run.nodeId === "export")?.status).toBe(
      "completed",
    );
    expect(result.run.nodeRuns.find((run) => run.nodeId === "publish")?.status).toBe(
      "completed",
    );
  });

  it("detects cycles before execution", async () => {
    await expect(
      runWorkflow(
        workflow(
          [
            node("a", "project.input", "trigger"),
            node("b", "idea.generate", "generation"),
          ],
          [
            ["a", "b"],
            ["b", "a"],
          ],
        ),
        "project-1",
      ),
    ).rejects.toThrow("ciclo detectado");
  });
});

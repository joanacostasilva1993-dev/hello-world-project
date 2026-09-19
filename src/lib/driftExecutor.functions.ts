import { z } from "zod";
import type { DriftBridgeManifest, DriftBridgeOperation } from "./driftBridge.functions";

export const driftExecutorModeSchema = z.enum(["preview", "local-mcp"]);
export type DriftExecutorMode = z.infer<typeof driftExecutorModeSchema>;

export const driftExecutorConfigSchema = z.object({
  mode: driftExecutorModeSchema,
  endpoint: z.string().url().optional(),
  token: z.string().min(1).optional(),
});

export type DriftExecutorConfig = z.infer<typeof driftExecutorConfigSchema>;

export const driftMcpPlanStepSchema = z.object({
  phase: z.enum(["prepare", "import", "place", "overlay", "verify", "export"]),
  operation: z.string(),
  itemId: z.string(),
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  requiresPreviousResult: z.boolean(),
  note: z.string(),
});

export type DriftMcpPlanStep = z.infer<typeof driftMcpPlanStepSchema>;

export const driftMcpExecutionPlanSchema = z.object({
  version: z.literal(1),
  target: z.literal("drift-mcp"),
  projectId: z.string(),
  title: z.string(),
  steps: z.array(driftMcpPlanStepSchema).max(2000),
  limitations: z.array(z.string()).max(20),
});

export type DriftMcpExecutionPlan = z.infer<typeof driftMcpExecutionPlanSchema>;

function mapOperation(operation: DriftBridgeOperation): DriftMcpPlanStep {
  if (operation.operation === "import_media") {
    return {
      phase: "import",
      operation: operation.operation,
      itemId: operation.itemId,
      tool: "import_media",
      args: { paths: [operation.url] },
      requiresPreviousResult: false,
      note: "O executor local deve converter URLs remotos em ficheiros locais antes de importar; o Drift importa caminhos locais/file://.",
    };
  }

  if (operation.operation === "place_clip") {
    return {
      phase: "place",
      operation: operation.operation,
      itemId: operation.itemId,
      tool: "place_clip",
      args: {
        asset: operation.sourceAssetId,
        at: operation.startSeconds,
        duration: operation.durationSeconds,
      },
      requiresPreviousResult: true,
      note: "O ID do clip deve ser obtido após a importação/inspeção; não assumimos que o ID do manifesto seja um UUID do Drift.",
    };
  }

  if (operation.operation === "add_text") {
    return {
      phase: "overlay",
      operation: operation.operation,
      itemId: operation.itemId,
      tool: "text",
      args: {
        text: operation.text,
        at: operation.startSeconds,
        duration: operation.durationSeconds,
      },
      requiresPreviousResult: false,
      note: "A camada local deverá escolher a operação de texto disponível no toolbox do Drift e aplicar estilo 9:16.",
    };
  }

  return {
    phase: "overlay",
    operation: operation.operation,
    itemId: operation.itemId,
    tool: "bookmark",
    args: { at: operation.startSeconds, label: operation.label },
    requiresPreviousResult: false,
    note: "Marcador de SFX é preservado como metadado de edição; a implementação pode depois mapear SFX para assets de áudio reais.",
  };
}

export function buildDriftMcpExecutionPlan(manifest: DriftBridgeManifest): DriftMcpExecutionPlan {
  const steps = manifest.operations.map(mapOperation);

  return driftMcpExecutionPlanSchema.parse({
    version: 1,
    target: "drift-mcp",
    projectId: manifest.projectId,
    title: manifest.title,
    steps: [
      {
        phase: "prepare",
        operation: "catalog",
        itemId: "project",
        tool: "catalog",
        args: { brief: true },
        requiresPreviousResult: false,
        note: "Descobrir a superfície MCP disponível nesta versão do Drift.",
      },
      ...steps,
      {
        phase: "verify",
        operation: "inspect",
        itemId: "project",
        tool: "inspect",
        args: { clips: true, detail: true },
        requiresPreviousResult: true,
        note: "Confirmar clips, duração e estado antes de exportar.",
      },
    ],
    limitations: [
      "O browser não deve guardar nem expor o token MCP do Drift.",
      "A execução real deve acontecer num bridge local/desktop com acesso ao processo do Drift.",
      "Importações remotas precisam de materialização local antes de import_media.",
      "IDs produzidos pelo Drift devem ser lidos entre batches; não encadear IDs recém-criados no mesmo apply.",
      "A execução MCP não é atómica; falhas podem deixar operações anteriores aplicadas.",
    ],
  });
}

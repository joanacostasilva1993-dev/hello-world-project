import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";

import { runOmniRoute, runOpenRouter, type AIRequest, type AIRoute } from "./ai.server";

const routeSchema = z.enum(["fast", "balanced", "quality"]);

export const hookMechanismSchema = z.enum([
  "curiosity_gap",
  "open_loop",
  "contrarian",
  "specificity",
  "stakes",
  "pattern_interrupt",
  "question",
  "reversal",
  "mystery",
  "unexpected_comparison",
]);

export const hookSchema = z.object({
  id: z.string().min(1).max(160),
  text: z.string().min(5).max(500),
  mechanism: hookMechanismSchema,
  promise: z.string().min(5).max(300),
  payoff: z.string().min(5).max(300),
  opportunityId: z.string().min(1).max(160),
  evidenceIds: z.array(z.string().min(1).max(160)).max(30),
  originalityNotes: z.array(z.string().min(1).max(300)).max(8),
  confidence: z.number().min(0).max(1),
  testVariantGroup: z.string().min(1).max(80),
});

export const hookGenerationSchema = z.object({
  hooks: z.array(hookSchema).min(1).max(10),
  selectionNotes: z.array(z.string().min(1).max(300)).max(8),
  hypothesesToTest: z.array(z.string().min(1).max(300)).max(8),
});

export type ViralFlowHook = z.infer<typeof hookSchema>;
export type HookGeneration = z.infer<typeof hookGenerationSchema>;

async function runHookAI(request: AIRequest) {
  if (process.env.AI_GATEWAY === "omniroute") return runOmniRoute(request);
  return runOpenRouter(request);
}

export const generateHooks = createServerFn({ method: "POST" })
  .validator(
    z.object({
      opportunity: z.object({
        id: z.string().min(1).max(160),
        gap: z.string().min(1).max(1000),
        concept: z.string().min(1).max(1000),
        whyDistinct: z.string().min(1).max(1000),
        evidenceIds: z.array(z.string().min(1).max(160)).max(30),
        confidence: z.number().min(0).max(1),
        hypothesis: z.string().min(1).max(1000),
        nextTest: z.string().min(1).max(1000),
      }),
      count: z.number().int().min(5).max(10).default(8),
      route: routeSchema.default("balanced"),
      language: z.string().min(2).max(20).default("pt-PT"),
    }),
  )
  .handler(async ({ data }) => {
    const result = await runHookAI({
      route: data.route as AIRoute,
      temperature: 0.25,
      system:
        "És o Hook Engine do ViralFlow. Gera hooks originais a partir de oportunidades evidenciadas. Prioriza precisão, rastreabilidade e originalidade, não promessas de viralização. Nunca inventes factos, métricas, citações ou evidência. Não copies títulos de referências. Se uma afirmação não estiver sustentada pelos dados fornecidos, transforma-a numa hipótese ou evita-a. Cada hook deve ter mecanismo, promessa e payoff coerentes. Devolve apenas JSON válido conforme o schema.",
      jsonSchema: {
        name: "viralflow_hook_generation",
        schema: z.toJSONSchema(hookGenerationSchema),
        strict: true,
      },
      prompt: JSON.stringify({
        task: "Gerar hooks diversificados para testar uma oportunidade de conteúdo.",
        language: data.language,
        count: data.count,
        opportunity: data.opportunity,
        rules: [
          "Não afirmar resultados garantidos.",
          "Não inventar factos ausentes da oportunidade.",
          "Não copiar títulos ou frases de referências.",
          "Variar mecanismos entre curiosity_gap, open_loop, contrarian, specificity, stakes, pattern_interrupt, question, reversal, mystery e unexpected_comparison.",
          "A promessa deve corresponder ao conteúdo que o futuro roteiro poderá realmente entregar.",
          "O payoff deve explicar o que o espectador recebe se continuar.",
          "evidenceIds devem ser apenas IDs fornecidos na oportunidade.",
          "confidence é confiança na coerência do hook com a evidência, não probabilidade de viralização.",
          "Agrupar variantes em testVariantGroup para facilitar A/B tests.",
        ],
      }),
    });

    return {
      ...result,
      parsed: hookGenerationSchema.parse(JSON.parse(result.content)),
    };
  });

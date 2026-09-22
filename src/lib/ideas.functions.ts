import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";

import { runOpenRouter, type AIRoute } from "./ai.server";

const ideaSchema = z.object({
  concept: z.string(),
  angle: z.string(),
  promise: z.string(),
  audience: z.string(),
  format: z.string(),
  hook: z.string(),
  differentiation: z.string(),
  validation: z.string(),
});

// Envelope que a IA deve devolver. Antes, `ideaSchema` existia mas nunca era
// usado para validar nada — a resposta era só JSON.parse "às cegas". Isto
// obriga o modelo, via response_format da OpenRouter, a cumprir a estrutura.
const ideasResponseSchema = z.object({
  ideas: z.array(ideaSchema).min(1).max(8),
});

const learningContextSchema = z.object({
  strongestPatterns: z.array(z.string()).max(8).default([]),
  weakPatterns: z.array(z.string()).max(8).default([]),
  experimentsToRun: z.array(z.string()).max(8).default([]),
});

export const generateContentIdeas = createServerFn({ method: "POST" })
  .validator(
    z.object({
      niche: z.string().min(2).max(200),
      audience: z.string().max(200).default(""),
      contentGaps: z.array(z.string()).min(1).max(12),
      dominantPatterns: z.array(z.string()).max(12).default([]),
      recurringTopics: z.array(z.string()).max(12).default([]),
      learningContext: learningContextSchema.default({ strongestPatterns: [], weakPatterns: [], experimentsToRun: [] }),
      route: z.enum(["fast", "balanced", "quality"]).default("balanced"),
    }),
  )
  .handler(async ({ data }) => {
    const result = await runOpenRouter({
      route: data.route as AIRoute,
      jsonSchema: { name: "viralflow_content_ideas", schema: z.toJSONSchema(ideasResponseSchema), strict: true },
      system:
        "És o Idea Engine do ViralFlow. Transforma sinais de inteligência de conteúdo em conceitos originais que um criador consiga produzir. Usa o Learning Loop como feedback do próprio canal: reforça padrões observados sem tratá-los como causalidade garantida e transforma experiências anteriores em hipóteses de novos testes. Não copies títulos, hooks ou conceitos das referências. Não inventes tendências externas, métricas ou garantias de desempenho. Devolve JSON válido, sem markdown.",
      prompt: JSON.stringify({
        task: "Gerar 6 ideias de conteúdo originais a partir de content gaps, padrões observados e aprendizagem do próprio canal.",
        context: {
          niche: data.niche,
          audience: data.audience,
          content_gaps: data.contentGaps,
          dominant_patterns: data.dominantPatterns,
          recurring_topics: data.recurringTopics,
          learning_loop: data.learningContext,
        },
        rules: [
          "Cada ideia deve explorar um ângulo claramente diferente.",
          "Usar os strongestPatterns como sinais, não como regras absolutas.",
          "Transformar weakPatterns em oportunidades de teste quando fizer sentido.",
          "Incorporar experimentos anteriores sem assumir que funcionaram causalmente.",
          "Evitar simples reescritas das referências.",
          "O hook deve abrir uma lacuna de curiosidade ou uma tensão concreta sem clickbait enganoso.",
          "A promessa deve ser específica e verificável pelo conteúdo.",
          "Explicar em uma frase como a ideia se diferencia.",
          "Indicar uma validação prática antes da produção.",
        ],
        output_schema: {
          ideas: [
            {
              concept: "string",
              angle: "string",
              promise: "string",
              audience: "string",
              format: "string",
              hook: "string",
              differentiation: "string",
              validation: "string",
            },
          ],
        },
      }),
    });

    return {
      ...result,
      parsed: parseIdeasResponse(result.content),
    };
  });

function parseIdeasResponse(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    const validated = ideasResponseSchema.safeParse(parsed);
    return validated.success ? (validated.data as unknown as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

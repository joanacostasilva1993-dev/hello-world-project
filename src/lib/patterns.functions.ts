import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runOmniRoute, runOpenRouter, type AIRequest, type AIRoute } from "./ai.server";

const videoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  publishedAt: z.string(),
  duration: z.string().optional(),
  tags: z.array(z.string()),
  viewCount: z.number().optional(),
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
  engagementRate: z.number().optional(),
  estimatedViewsPerDay: z.number().optional(),
});

const contentGapSchema = z.object({
  dominant_patterns: z.array(z.string()),
  recurring_topics: z.array(z.string()),
  title_patterns: z.array(z.string()),
  format_patterns: z.array(z.string()),
  underused_angles: z.array(z.string()),
  content_gaps: z.array(z.string()),
  testable_ideas: z.array(z.object({
    concept: z.string(),
    why_it_is_distinct: z.string(),
    reference_signal: z.string(),
  })),
  hypotheses_to_validate: z.array(z.string()),
});

async function runPatternAI(request: AIRequest) {
  if (process.env.AI_GATEWAY === "omniroute") return runOmniRoute(request);
  return runOpenRouter(request);
}

export const analyzeContentGap = createServerFn({ method: "POST" })
  .validator(
    z.object({
      referenceVideos: z.array(videoSchema).min(2).max(24),
      route: z.enum(["fast", "balanced", "quality"]).default("balanced"),
    }),
  )
  .handler(async ({ data }) => {
    const result = await runPatternAI({
      route: data.route as AIRoute,
      jsonSchema: {
        name: "viralflow_content_gap",
        schema: z.toJSONSchema(contentGapSchema),
        strict: true,
      },
      system:
        "És o Viral Pattern Engine do ViralFlow. Analisa apenas os dados fornecidos. Identifica padrões repetidos e espaços de conteúdo ainda não cobertos pela amostra. Não inventes tendências externas, métricas ou causalidade. Oportunidades são hipóteses, não garantias de desempenho. Devolve JSON válido sem markdown.",
      prompt: JSON.stringify({
        task: "Encontrar padrões de conteúdo e content gaps numa coleção de vídeos de referência.",
        references: data.referenceVideos,
        rules: [
          "Cada padrão deve ser sustentado por mais de um sinal quando possível.",
          "Não confundir ausência na amostra com ausência absoluta no mercado.",
          "Não transformar visualizações em causalidade.",
          "Ideias devem explorar lacunas sem copiar títulos ou estruturas literalmente.",
        ],
      }),
    });

    return {
      ...result,
      parsed: contentGapSchema.parse(JSON.parse(result.content)),
    };
  });

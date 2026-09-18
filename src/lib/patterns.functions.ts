import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { runOpenRouter, type AIRoute } from "./ai.server";

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

export const analyzeContentGap = createServerFn({ method: "POST" })
  .validator(
    z.object({
      referenceVideos: z.array(videoSchema).min(2).max(24),
      route: z.enum(["fast", "balanced", "quality"]).default("balanced"),
    }),
  )
  .handler(async ({ data }) => {
    const result = await runOpenRouter({
      route: data.route as AIRoute,
      system:
        "És o Viral Pattern Engine do ViralFlow. Analisa apenas os dados fornecidos. Identifica padrões repetidos e espaços de conteúdo ainda não cobertos pela amostra. Não inventes tendências externas, métricas ou causalidade. Oportunidades são hipóteses, não garantias de desempenho. Devolve JSON válido, sem markdown.",
      prompt: JSON.stringify({
        task:
          "Encontrar padrões de conteúdo e content gaps numa coleção de vídeos de referência.",
        references: data.referenceVideos,
        output_schema: {
          dominant_patterns: ["string"],
          recurring_topics: ["string"],
          title_patterns: ["string"],
          format_patterns: ["string"],
          underused_angles: ["string"],
          content_gaps: ["string"],
          testable_ideas: [
            {
              concept: "string",
              why_it_is_distinct: "string",
              reference_signal: "string",
            },
          ],
          hypotheses_to_validate: ["string"],
        },
      }),
    });

    return {
      ...result,
      parsed: parseJsonObject(result.content),
    };
  });

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getOpenRouterStatus, runOpenRouter, type AIRoute } from "./ai.server";

const routeSchema = z.enum(["fast", "balanced", "quality"]);

export const getAIProviderStatus = createServerFn({ method: "GET" }).handler(() => {
  return getOpenRouterStatus();
});

export const analyzeContentReference = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1).max(500),
      author: z.string().min(1).max(200),
      url: z.string().url(),
      route: routeSchema.default("balanced"),
    }),
  )
  .handler(async ({ data }) => {
    const result = await runOpenRouter({
      route: data.route as AIRoute,
      system:
        "És o motor de Content Intelligence do ViralFlow. Analisa referências de conteúdo de forma factual e operacional. Não inventes métricas que não foram fornecidas. Devolve JSON válido, sem markdown.",
      prompt: JSON.stringify({
        task: "Extrair um primeiro Content DNA a partir de metadados públicos de um vídeo.",
        reference: {
          title: data.title,
          author: data.author,
          url: data.url,
        },
        output_schema: {
          hook: "string",
          promise: "string",
          topic: "string",
          audience_signal: "string",
          narrative_pattern: "string",
          packaging_signals: ["string"],
          hypotheses_to_verify: ["string"],
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

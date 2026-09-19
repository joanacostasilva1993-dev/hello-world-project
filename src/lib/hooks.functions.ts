import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runOpenRouter, type AIRoute } from "./ai.server";

export const generateHooks = createServerFn({ method: "POST" })
  .validator(z.object({
    concept: z.string().min(2).max(500),
    angle: z.string().max(500),
    promise: z.string().max(500),
    audience: z.string().max(300),
    format: z.string().max(200),
    route: z.enum(["fast","balanced","quality"]).default("balanced"),
  }))
  .handler(async ({ data }) => {
    const result = await runOpenRouter({
      route: data.route as AIRoute,
      system: "És o Hook Lab do ViralFlow. Cria hooks originais para conteúdo. Não prometas resultados, não uses clickbait enganoso e não copies referências. Cada hook deve criar tensão, curiosidade ou uma promessa concreta que o vídeo consiga cumprir. Devolve JSON válido, sem markdown.",
      prompt: JSON.stringify({
        task: "Criar 12 hooks diversificados para uma ideia de conteúdo e classificá-los por mecanismo narrativo.",
        idea: data,
        output_schema: {
          hooks: [{
            text: "string",
            mechanism: "string",
            opening_visual: "string",
            risk: "low | medium | high",
            why_it_works: "string"
          }]
        }
      }),
    });
    return { ...result, parsed: parseJsonObject(result.content) };
  });

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

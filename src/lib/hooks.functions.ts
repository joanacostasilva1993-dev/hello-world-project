import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runOpenRouter, type AIRoute } from "./ai.server";

const learningContextSchema = z.object({
  strongestPatterns: z.array(z.string()).max(8).default([]),
  weakPatterns: z.array(z.string()).max(8).default([]),
  experimentsToRun: z.array(z.string()).max(8).default([]),
});

export const generateHooks = createServerFn({ method: "POST" })
  .validator(z.object({
    concept: z.string().min(2).max(500),
    angle: z.string().max(500),
    promise: z.string().max(500),
    audience: z.string().max(300),
    format: z.string().max(200),
    learningContext: learningContextSchema.default({}),
    route: z.enum(["fast","balanced","quality"]).default("balanced"),
  }))
  .handler(async ({ data }) => {
    const result = await runOpenRouter({
      route: data.route as AIRoute,
      system: "És o Hook Lab do ViralFlow. Cria hooks originais para conteúdo. Usa o Learning Loop para variar e testar mecanismos de abertura com base em sinais observados do próprio canal, sem tratar correlação como causalidade. Não prometas resultados, não uses clickbait enganoso e não copies referências. Cada hook deve criar tensão, curiosidade ou uma promessa concreta que o vídeo consiga cumprir. Devolve JSON válido, sem markdown.",
      prompt: JSON.stringify({
        task: "Criar 12 hooks diversificados para uma ideia de conteúdo, usando aprendizagem anterior como contexto experimental.",
        idea: {
          concept: data.concept,
          angle: data.angle,
          promise: data.promise,
          audience: data.audience,
          format: data.format,
        },
        learning_loop: data.learningContext,
        rules: [
          "Variar mecanismos narrativos, não apenas palavras.",
          "Dar prioridade a mecanismos compatíveis com strongestPatterns, mas manter diversidade.",
          "Usar weakPatterns e experimentsToRun como hipóteses de teste.",
          "Não afirmar que um hook irá viralizar.",
        ],
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

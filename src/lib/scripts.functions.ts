import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runOpenRouter } from "./ai.server";

export const generateScript = createServerFn({ method: "POST" })
  .validator(z.object({
    concept: z.string().min(2).max(600),
    angle: z.string().max(500),
    promise: z.string().max(500),
    audience: z.string().max(300),
    format: z.string().max(200),
    hook: z.string().min(2).max(500),
    durationSeconds: z.number().int().min(15).max(600).default(60),
    route: z.enum(["fast","balanced","quality"]).default("balanced"),
  }))
  .handler(async ({ data }) => {
    const result = await runOpenRouter({
      route: data.route,
      system: "És o Script Engine do ViralFlow. Transforma uma ideia e hook em um roteiro original, claro e produzível. Mantém a promessa compatível com o conteúdo. Não inventes factos externos: quando algo factual não estiver fornecido, marca como ponto a verificar. Evita introduções genéricas, enchimento e clickbait enganoso. Estrutura o ritmo para vídeo curto, mas sem garantir retenção ou viralização. Devolve JSON válido, sem markdown.",
      prompt: JSON.stringify({
        task: "Criar um roteiro audiovisual pronto para produção.",
        input: data,
        output_schema: {
          title: "string",
          logline: "string",
          estimated_duration_seconds: "number",
          scenes: [{
            time: "string",
            visual: "string",
            narration: "string",
            on_screen_text: "string",
            sfx: "string",
            transition: "string"
          }],
          ending: "string",
          verification_notes: ["string"]
        }
      }),
    });
    return { ...result, parsed: parseJsonObject(result.content) };
  });

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

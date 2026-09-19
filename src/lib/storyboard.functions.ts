import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runOpenRouter } from "./ai.server";

export const generateStoryboard = createServerFn({ method: "POST" })
  .validator(z.object({
    title: z.string().max(300),
    format: z.string().max(100),
    scenes: z.array(z.object({
      time: z.string(),
      visual: z.string(),
      narration: z.string(),
      on_screen_text: z.string(),
      sfx: z.string(),
      transition: z.string(),
    })).min(1).max(60),
    route: z.enum(["fast","balanced","quality"]).default("balanced"),
  }))
  .handler(async ({ data }) => {
    const result = await runOpenRouter({
      route: data.route,
      system: "És o Storyboard Engine do ViralFlow. Converte um roteiro audiovisual em planos visuais concretos e produzíveis. Mantém continuidade de personagens, locais, objetos e iluminação. Não inventes factos narrativos que alterem o roteiro. Para cada cena define enquadramento, movimento de câmara, composição, continuidade, prompt de imagem e prompt de vídeo. Os prompts devem ser específicos e evitar estética genérica de IA. Devolve JSON válido, sem markdown.",
      prompt: JSON.stringify({
        task: "Criar um storyboard técnico multimodal a partir do roteiro.",
        input: data,
        output_schema: {
          visual_direction: "string",
          continuity_notes: ["string"],
          shots: [{
            scene: "number",
            time: "string",
            shot_type: "string",
            camera: "string",
            composition: "string",
            action: "string",
            continuity: "string",
            image_prompt: "string",
            video_prompt: "string",
            asset_type: "image | video | mixed"
          }]
        }
      }),
    });
    return { ...result, parsed: parseJsonObject(result.content) };
  });

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";

import { runOmniRoute, runOpenRouter, type AIRequest } from "./ai.server";

export const scriptDurationSchema = z.object({
  targetSeconds: z.number().int().min(15).max(1800),
  toleranceSeconds: z.number().int().min(3).max(60),
  targetWords: z.number().int().min(30).max(4500),
  wordsPerMinute: z.number().int().min(60).max(240),
});

export const scriptSceneSchema = z.object({
  id: z.string().min(1).max(100),
  startSeconds: z.number().min(0),
  endSeconds: z.number().positive(),
  visual: z.string().min(1).max(1200),
  narration: z.string().min(1).max(2500),
  onScreenText: z.string().max(300),
  sfx: z.string().max(300),
  transition: z.string().max(300),
  beat: z.enum(["hook", "setup", "escalation", "reveal", "payoff", "cta", "bridge"]),
});

export const scriptSchema = z.object({
  title: z.string().min(1).max(300),
  logline: z.string().min(1).max(600),
  duration: scriptDurationSchema,
  scenes: z.array(scriptSceneSchema).min(1).max(80),
  ending: z.string().min(1).max(1000),
  verificationNotes: z.array(z.string().min(1).max(500)).max(12),
});

export type ViralFlowScript = z.infer<typeof scriptSchema>;

const inputSchema = z.object({
  concept: z.string().min(2).max(600),
  angle: z.string().max(500),
  promise: z.string().max(500),
  audience: z.string().max(300),
  format: z.string().max(200),
  hook: z.string().min(2).max(500),
  targetSeconds: z.number().int().min(15).max(1800).default(60),
  wordsPerMinute: z.number().int().min(60).max(240).default(150),
  learningContext: z.object({
    strongestPatterns: z.array(z.string()).max(8).default([]),
    weakPatterns: z.array(z.string()).max(8).default([]),
    experimentsToRun: z.array(z.string()).max(8).default([]),
  }).default({ strongestPatterns: [], weakPatterns: [], experimentsToRun: [] }),
  route: z.enum(["fast", "balanced", "quality"]).default("balanced"),
});

function getDurationPlan(targetSeconds: number, wordsPerMinute: number) {
  return {
    targetSeconds,
    toleranceSeconds: Math.max(4, Math.round(targetSeconds * 0.06)),
    targetWords: Math.round((targetSeconds / 60) * wordsPerMinute),
    wordsPerMinute,
  };
}

async function runScriptAI(request: AIRequest) {
  if (process.env.AI_GATEWAY === "omniroute") return runOmniRoute(request);
  return runOpenRouter(request);
}

export const generateScript = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }) => {
    const duration = getDurationPlan(data.targetSeconds, data.wordsPerMinute);

    const result = await runScriptAI({
      route: data.route,
      temperature: 0.2,
      system:
        "És o Script Engine do ViralFlow. Produz roteiros audiovisuais estruturados e verificáveis. Não inventes factos, métricas, fontes ou acontecimentos. Usa apenas informação fornecida; conteúdo factual não fornecido deve ser colocado em verificationNotes como ponto a verificar. A duração é uma restrição de produção: aproxima o texto ao targetWords e organiza cenas dentro do targetSeconds. Não prometas viralização. Mantém hook, promessa e payoff coerentes. Evita enchimento, frases genéricas e clickbait enganoso. Devolve exclusivamente JSON conforme o schema.",
      jsonSchema: {
        name: "viralflow_script",
        schema: z.toJSONSchema(scriptSchema),
        strict: true,
      },
      prompt: JSON.stringify({
        task: "Criar um roteiro pronto para a fase de voz, storyboard e timeline.",
        input: {
          concept: data.concept,
          angle: data.angle,
          promise: data.promise,
          audience: data.audience,
          format: data.format,
          hook: data.hook,
          duration,
          learningContext: data.learningContext,
        },
        rules: [
          "O primeiro beat deve cumprir a função de hook sem repetir desnecessariamente o hook.",
          "A soma dos tempos das cenas deve caber no targetSeconds com tolerância mínima.",
          "Cada cena deve ter startSeconds < endSeconds e estar em ordem cronológica.",
          "Narration é o texto que será efetivamente narrado.",
          "onScreenText deve ser curto e não deve inventar informação que não esteja na narração.",
          "O payoff deve responder à promessa.",
          "verificationNotes deve conter qualquer afirmação factual que exija verificação externa.",
          "Não usar palavras ou números apenas para atingir a contagem; priorizar naturalidade.",
          "A duração estimada é uma previsão. A duração real será determinada pelo áudio final.",
        ],
      }),
    });

    const parsed = scriptSchema.parse(JSON.parse(result.content));

    return {
      ...result,
      parsed,
      timing: {
        targetSeconds: duration.targetSeconds,
        targetWords: duration.targetWords,
        actualNarrationWords: parsed.scenes.reduce(
          (total, scene) => total + scene.narration.trim().split(/\s+/).filter(Boolean).length,
          0,
        ),
        toleranceSeconds: duration.toleranceSeconds,
      },
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getOpenRouterStatus, runOmniRoute, runOpenRouter, type AIRequest, type AIRoute } from "./ai.server";

const routeSchema = z.enum(["fast", "balanced", "quality"]);
async function runPreferredAI(request: AIRequest) {
  if (process.env.AI_GATEWAY === "omniroute") return runOmniRoute(request);
  return runOpenRouter(request);
}


const snapshotSchema = z.object({
  title: z.string(),
  description: z.string(),
  channelTitle: z.string(),
  publishedAt: z.string(),
  duration: z.string().optional(),
  tags: z.array(z.string()),
  viewCount: z.number().optional(),
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
});

const channelVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  channelId: z.string(),
  channelTitle: z.string(),
  publishedAt: z.string(),
  duration: z.string().optional(),
  tags: z.array(z.string()),
  categoryId: z.string().optional(),
  viewCount: z.number().optional(),
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
  engagementRate: z.number().optional(),
  estimatedViewsPerDay: z.number().optional(),
  thumbnail: z.string().optional(),
});

export const getAIProviderStatus = createServerFn({ method: "GET" }).handler(() => {
  return getOpenRouterStatus();
});

const contentDnaSchema = z.object({
  hook: z.string(),
  promise: z.string(),
  topic: z.string(),
  audience_signal: z.string(),
  narrative_pattern: z.string(),
  retention_mechanics: z.array(z.string()),
  packaging_signals: z.array(z.string()),
  visual_signals: z.array(z.string()),
  content_angles: z.array(z.string()),
  opportunities: z.array(z.string()),
  hook_variants: z.array(z.string()),
  hypotheses_to_verify: z.array(z.string()),
});

const channelDnaSchema = z.object({
  channel_positioning: z.string(),
  audience_signal: z.string(),
  content_pillars: z.array(z.string()),
  title_patterns: z.array(z.string()),
  publishing_pattern: z.string(),
  standout_formats: z.array(z.string()),
  opportunity_signals: z.array(z.string()),
  hypotheses_to_validate: z.array(z.string()),
});

export const analyzeContentReference = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(1).max(500),
      author: z.string().min(1).max(200),
      url: z.string().url(),
      route: routeSchema.default("balanced"),
      snapshot: snapshotSchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const result = await runPreferredAI({
      route: data.route as AIRoute,
      system:
        "És o motor de Content Intelligence do ViralFlow. Analisa referências de conteúdo de forma factual e operacional. Não inventes métricas que não foram fornecidas. Separa sinais observáveis de hipóteses. Devolve JSON válido, sem markdown.",
      jsonSchema: { name: "viralflow_content_dna", schema: z.toJSONSchema(contentDnaSchema), strict: true },
      prompt: JSON.stringify({
        task: "Construir Content DNA operacional a partir de uma referência pública de vídeo.",
        reference: {
          title: data.title,
          author: data.author,
          url: data.url,
          snapshot: data.snapshot,
        },
        rules: [
          "Não inventar métricas.",
          "Não tratar hipóteses como factos.",
          "Extrair padrões úteis para criação de conteúdo original.",
          "Os hooks alternativos devem ser variações originais, não cópias do título.",
        ],
        output_schema: {
          hook: "string",
          promise: "string",
          topic: "string",
          audience_signal: "string",
          narrative_pattern: "string",
          retention_mechanics: ["string"],
          packaging_signals: ["string"],
          visual_signals: ["string"],
          content_angles: ["string"],
          opportunities: ["string"],
          hook_variants: ["string"],
          hypotheses_to_verify: ["string"],
        },
      }),
    });

    return {
      ...result,
      parsed: contentDnaSchema.parse(JSON.parse(result.content)),
    };
  });

export const analyzeChannelIntelligence = createServerFn({ method: "POST" })
  .validator(
    z.object({
      channel: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        publishedAt: z.string(),
        subscriberCount: z.number().optional(),
        videoCount: z.number().optional(),
        viewCount: z.number().optional(),
        thumbnail: z.string().optional(),
        uploadsPlaylistId: z.string().optional(),
      }),
      videos: z.array(channelVideoSchema).min(1).max(24),
      route: routeSchema.default("balanced"),
    }),
  )
  .handler(async ({ data }) => {
    const result = await runPreferredAI({
      route: data.route as AIRoute,
      jsonSchema: { name: "viralflow_channel_dna", schema: z.toJSONSchema(channelDnaSchema), strict: true },
      system:
        "És o Channel Intelligence Engine do ViralFlow. Analisa um canal público do YouTube de forma factual e operacional. Usa apenas os dados fornecidos. Não inventes métricas, não atribuas causalidade e não declares probabilidade de viralização. Distingue padrões observáveis de hipóteses. Devolve JSON válido, sem markdown.",
      prompt: JSON.stringify({
        task:
          "Construir Channel DNA a partir dos dados públicos do canal e de uma amostra dos vídeos mais recentes.",
        channel: data.channel,
        recent_videos: data.videos,
        rules: [
          "Não inventar dados ausentes.",
          "Trata métricas derivadas como estimativas e explica a base quando necessário.",
          "Identifica padrões de títulos, temas, formatos e cadência quando houver evidência suficiente.",
          "Não confundir correlação com causalidade.",
          "As oportunidades são hipóteses de exploração, não garantias de desempenho.",
        ],
        output_schema: {
          channel_positioning: "string",
          audience_signal: "string",
          content_pillars: ["string"],
          title_patterns: ["string"],
          publishing_pattern: "string",
          standout_formats: ["string"],
          opportunity_signals: ["string"],
          hypotheses_to_validate: ["string"],
        },
      }),
    });

    return {
      ...result,
      parsed: channelDnaSchema.parse(JSON.parse(result.content)),
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

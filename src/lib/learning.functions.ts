import { z } from "zod";

export const platformSchema = z.enum(["youtube", "instagram", "facebook", "tiktok"]);
export type Platform = z.infer<typeof platformSchema>;

export const performanceInputSchema = z.object({
  platform: platformSchema,
  contentId: z.string().min(1).max(200),
  title: z.string().max(500).default(""),
  publishedAt: z.string().max(100).default(""),
  impressions: z.number().nonnegative().optional(),
  views: z.number().nonnegative().optional(),
  watchTimeSeconds: z.number().nonnegative().optional(),
  averageViewDurationSeconds: z.number().nonnegative().optional(),
  retentionPercent: z.number().min(0).max(100).optional(),
  likes: z.number().nonnegative().optional(),
  comments: z.number().nonnegative().optional(),
  shares: z.number().nonnegative().optional(),
  saves: z.number().nonnegative().optional(),
  followersGained: z.number().nonnegative().optional(),
  durationSeconds: z.number().positive().optional(),
  hookVariant: z.string().max(300).optional(),
  topic: z.string().max(300).optional(),
  format: z.string().max(100).optional(),
});

export type PerformanceInput = z.infer<typeof performanceInputSchema>;

export const signalSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  interpretation: z.string(),
});

export const learningReportSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  sampleSize: z.number().int().nonnegative(),
  platform: platformSchema,
  signals: z.array(signalSchema),
  strongestPatterns: z.array(z.string()),
  weakPatterns: z.array(z.string()),
  experimentsToRun: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  caveats: z.array(z.string()),
});

export type LearningReport = z.infer<typeof learningReportSchema>;

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function safeRate(n?: number, d?: number) {
  return n != null && d != null && d > 0 ? (n / d) * 100 : undefined;
}

export function buildLearningReport(rows: PerformanceInput[]): LearningReport {
  const parsed = rows.map((row) => performanceInputSchema.parse(row));
  if (!parsed.length) throw new Error("É necessária pelo menos uma linha de desempenho.");

  const platforms = new Set(parsed.map((row) => row.platform));
  if (platforms.size > 1) {
    throw new Error("Um learning report deve comparar conteúdos da mesma plataforma. Cria um relatório separado para cada plataforma.");
  }

  const platform = parsed[0].platform;
  const views = parsed.map((r) => r.views).filter((v): v is number => v != null);
  const retention = parsed.map((r) => r.retentionPercent).filter((v): v is number => v != null);
  const avgDuration = parsed.map((r) => r.averageViewDurationSeconds).filter((v): v is number => v != null);
  const shareRates = parsed.map((r) => safeRate(r.shares, r.views)).filter((v): v is number => v != null);
  const commentRates = parsed.map((r) => safeRate(r.comments, r.views)).filter((v): v is number => v != null);
  const likeRates = parsed.map((r) => safeRate(r.likes, r.views)).filter((v): v is number => v != null);
  const saveRates = parsed.map((r) => safeRate(r.saves, r.views)).filter((v): v is number => v != null);
  const followRates = parsed.map((r) => safeRate(r.followersGained, r.views)).filter((v): v is number => v != null);

  const signals: z.infer<typeof signalSchema>[] = [];
  if (views.length) signals.push({ name: "average_views", value: avg(views), unit: "views", interpretation: "Média de visualizações da amostra." });
  if (retention.length) signals.push({ name: "average_retention", value: avg(retention), unit: "%", interpretation: "Retenção média reportada pelo canal." });
  if (avgDuration.length) signals.push({ name: "average_view_duration", value: avg(avgDuration), unit: "seconds", interpretation: "Tempo médio de consumo reportado." });
  if (shareRates.length) signals.push({ name: "share_rate", value: avg(shareRates), unit: "%", interpretation: "Partilha relativa às visualizações." });
  if (commentRates.length) signals.push({ name: "comment_rate", value: avg(commentRates), unit: "%", interpretation: "Comentários relativos às visualizações." });
  if (likeRates.length) signals.push({ name: "like_rate", value: avg(likeRates), unit: "%", interpretation: "Likes relativos às visualizações." });
  if (saveRates.length) signals.push({ name: "save_rate", value: avg(saveRates), unit: "%", interpretation: "Guardados relativos às visualizações, quando disponíveis." });
  if (followRates.length) signals.push({ name: "follow_conversion", value: avg(followRates), unit: "%", interpretation: "Seguidores ganhos relativos às visualizações, quando disponíveis." });

  const sortedViews = [...views].sort((a, b) => a - b);
  const medianViews = sortedViews.length ? sortedViews[Math.floor((sortedViews.length - 1) / 2)] : 0;
  const top = parsed.filter((r) => (r.views ?? 0) >= medianViews);
  const bottom = parsed.filter((r) => (r.views ?? 0) < medianViews);
  const topRetention = avg(top.map((r) => r.retentionPercent).filter((v): v is number => v != null));
  const bottomRetentionValues = bottom.map((r) => r.retentionPercent).filter((v): v is number => v != null);
  const bottomRetention = avg(bottomRetentionValues);

  const strongestPatterns: string[] = [];
  const weakPatterns: string[] = [];
  if (retention.length && bottomRetentionValues.length && topRetention > bottomRetention + 5) {
    strongestPatterns.push("Conteúdos acima da mediana combinam-se com retenção superior à metade inferior da amostra.");
  }
  if (shareRates.length && avg(shareRates) > 1) {
    strongestPatterns.push("A amostra apresenta sinal mensurável de partilha; testar temas que incentivem distribuição entre pares.");
  }
  if (saveRates.length && avg(saveRates) > 1) {
    strongestPatterns.push("Existe sinal de conteúdo guardável; testar formatos de referência, listas ou explicações.");
  }
  if (parsed.some((r) => r.hookVariant)) {
    strongestPatterns.push("Hooks estão identificados como variável experimental e podem ser comparados entre publicações.");
  }
  if (views.length && medianViews > 0) {
    strongestPatterns.push("A mediana de visualizações pode servir como baseline interno para novos testes.");
  }

  if (retention.length && bottomRetentionValues.length && topRetention < bottomRetention + 3) {
    weakPatterns.push("A amostra não mostra diferença clara de retenção entre metade superior e inferior.");
  }
  if (!bottom.length && views.length) {
    weakPatterns.push("Todos os conteúdos estão na metade superior por terem visualizações iguais ou muito próximas; a comparação por mediana é pouco discriminativa.");
  }
  if (parsed.length < 10) {
    weakPatterns.push("A amostra ainda é pequena para conclusões fortes.");
  }

  const experimentsToRun = [
    "Testar dois hooks para o mesmo conceito, mantendo duração e promessa semelhantes.",
    "Repetir o formato do melhor conteúdo com um ângulo diferente, sem copiar o conteúdo de referência.",
    "Testar uma abertura mais rápida e comparar retenção inicial com o baseline.",
    "Separar tema, hook e formato como variáveis para evitar atribuir causalidade ao fator errado.",
  ];

  const confidence = parsed.length >= 30 ? "high" : parsed.length >= 10 ? "medium" : "low";

  return learningReportSchema.parse({
    version: 1,
    generatedAt: new Date().toISOString(),
    sampleSize: parsed.length,
    platform,
    signals,
    strongestPatterns,
    weakPatterns,
    experimentsToRun,
    confidence,
    caveats: [
      "Sinais observáveis não revelam os sistemas internos de recomendação das plataformas.",
      "Correlação entre uma métrica e desempenho não prova causalidade.",
      "Comparações são mais úteis dentro do mesmo canal, formato e período.",
    ],
  });
}

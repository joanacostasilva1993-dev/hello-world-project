import { z } from "zod";

export const evidenceTypeSchema = z.enum([
  "fact",
  "claim",
  "opinion",
  "inference",
  "uncertainty",
]);

export const evidenceItemSchema = z.object({
  id: z.string().min(1).max(120),
  statement: z.string().min(1).max(2000),
  type: evidenceTypeSchema,
  sourceUrl: z.string().url().optional(),
  sourceTitle: z.string().max(300).optional(),
  confidence: z.number().min(0).max(1),
  verifiedAt: z.string().datetime().optional(),
});

export const researchBriefSchema = z.object({
  required: z.boolean(),
  query: z.string().max(1000),
  topic: z.string().min(1).max(300),
  evidence: z.array(evidenceItemSchema).max(200),
  unresolvedClaims: z.array(z.string().max(500)).max(50),
  researchedAt: z.string().datetime().optional(),
});

export type ResearchBrief = z.infer<typeof researchBriefSchema>;

export const originalitySignalSchema = z.object({
  category: z.enum([
    "cliche",
    "generic-opening",
    "repeated-structure",
    "predictable-transition",
    "empty-hype",
    "unsupported-claim",
    "robotic-language",
    "library-similarity",
    "reference-copy-risk",
  ]),
  severity: z.enum(["info", "warning", "blocker"]),
  message: z.string().min(1).max(500),
  evidence: z.string().max(1000).optional(),
});

export const originalityReportSchema = z.object({
  originalAngle: z.string().min(1).max(1000),
  signals: z.array(originalitySignalSchema).max(100),
  sourceSimilarityRisk: z.number().min(0).max(1),
  creatorLibrarySimilarityRisk: z.number().min(0).max(1),
  passed: z.boolean(),
});

export type OriginalityReport = z.infer<typeof originalityReportSchema>;

export const visualContinuitySchema = z.object({
  characterDna: z.record(z.unknown()).default({}),
  locationDna: z.record(z.unknown()).default({}),
  objectDna: z.record(z.unknown()).default({}),
  styleDna: z.record(z.unknown()).default({}),
});

export const qualityDimensionSchema = z.object({
  score: z.number().min(0).max(100),
  blockers: z.array(z.string().max(500)).max(30),
  warnings: z.array(z.string().max(500)).max(50),
});

export const contentQualityReportSchema = z.object({
  originality: qualityDimensionSchema,
  research: qualityDimensionSchema,
  narrative: qualityDimensionSchema,
  visual: qualityDimensionSchema,
  valueDensity: qualityDimensionSchema,
  repetition: qualityDimensionSchema,
  policy: qualityDimensionSchema,
  copyrightRisk: qualityDimensionSchema,
  aiDisclosure: qualityDimensionSchema,
  overallPassed: z.boolean(),
  generatedAt: z.string().datetime(),
});

export type ContentQualityReport = z.infer<typeof contentQualityReportSchema>;

export const policyRuleSchema = z.object({
  id: z.string().min(1).max(120),
  platform: z.enum(["youtube", "tiktok", "instagram", "facebook"]),
  version: z.string().min(1).max(80),
  category: z.enum([
    "originality",
    "reused-content",
    "spam",
    "copyright",
    "misleading",
    "ai-disclosure",
    "advertiser-suitability",
  ]),
  description: z.string().min(1).max(1000),
  sourceUrl: z.string().url(),
  lastCheckedAt: z.string().datetime(),
});

export const policyRegistrySchema = z.object({
  rules: z.array(policyRuleSchema).max(500),
  updatedAt: z.string().datetime(),
});

export type PolicyRegistry = z.infer<typeof policyRegistrySchema>;

export const packagingPromiseSchema = z.object({
  title: z.string().min(1).max(300),
  thumbnailPromise: z.string().max(500),
  hookPromise: z.string().max(1000),
  payoff: z.string().max(1500),
  aligned: z.boolean(),
  blockers: z.array(z.string().max(500)).max(20),
});

export type PackagingPromise = z.infer<typeof packagingPromiseSchema>;

export function requiresResearch(topic: string, categories: string[] = []): boolean {
  const text = `${topic} ${categories.join(" ")}`.toLowerCase();
  return [
    "science",
    "ciência",
    "history",
    "história",
    "technology",
    "tecnologia",
    "current",
    "atual",
    "statistics",
    "estatística",
    "health",
    "saúde",
    "economy",
    "economia",
    "politics",
    "política",
    "legislation",
    "legislação",
    "law",
    "lei",
    "controversial",
    "controverso",
  ].some((keyword) => text.includes(keyword));
}

export function validateResearchBrief(input: ResearchBrief): ResearchBrief {
  const brief = researchBriefSchema.parse(input);

  if (brief.required && brief.evidence.length === 0) {
    throw new Error("Research obrigatório sem evidências verificáveis.");
  }

  if (brief.unresolvedClaims.length > 0) {
    throw new Error(
      `Existem claims não resolvidos: ${brief.unresolvedClaims.slice(0, 3).join("; ")}`,
    );
  }

  return brief;
}

export function validateOriginalityReport(
  input: OriginalityReport,
): OriginalityReport {
  const report = originalityReportSchema.parse(input);
  const hasBlocker = report.signals.some(
    (signal) => signal.severity === "blocker",
  );

  if (report.passed && hasBlocker) {
    throw new Error("Originality report marcado como passed apesar de conter blocker.");
  }

  return report;
}

export function validatePackagingPromise(
  input: PackagingPromise,
): PackagingPromise {
  const packaging = packagingPromiseSchema.parse(input);

  if (packaging.aligned && packaging.blockers.length > 0) {
    throw new Error("Packaging marcado como aligned apesar de conter blockers.");
  }

  return packaging;
}

export function validateQualityReport(
  input: ContentQualityReport,
): ContentQualityReport {
  const report = contentQualityReportSchema.parse(input);
  const dimensions = Object.values(report).filter(
    (value): value is z.infer<typeof qualityDimensionSchema> =>
      typeof value === "object" &&
      value !== null &&
      "score" in value &&
      "blockers" in value &&
      "warnings" in value,
  );

  const hasBlocker = dimensions.some((dimension) => dimension.blockers.length > 0);

  if (report.overallPassed && hasBlocker) {
    throw new Error("Quality report marcado como passed apesar de conter blockers.");
  }

  return report;
}

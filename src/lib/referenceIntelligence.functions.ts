import { z } from "zod";

export const evidenceTypeSchema = z.enum(["FACT", "CLAIM", "OPINION", "INFERENCE", "UNCERTAINTY"]);

export const evidenceItemSchema = z.object({
  id: z.string().min(1),
  type: evidenceTypeSchema,
  statement: z.string().min(1),
  source: z.string().min(1),
  confidence: z.number().min(0).max(1),
  basis: z.string().min(1),
});

export const decisionLogEntrySchema = z.object({
  decision: z.string().min(1),
  rationale: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.string()).default([]),
});

export const referenceIntelligenceSchema = z.object({
  sourceType: z.enum(["video", "channel"]),
  sourceUrl: z.string().url(),
  resolvedAt: z.string().datetime(),
  evidence: z.array(evidenceItemSchema),
  decisions: z.array(decisionLogEntrySchema),
  confidence: z.number().min(0).max(1),
  limitations: z.array(z.string()),
});

export type ReferenceIntelligence = z.infer<typeof referenceIntelligenceSchema>;

export function buildReferenceEvidence(input: {
  sourceType: "video" | "channel";
  sourceUrl: string;
  facts: Array<{ statement: string; source: string; basis: string }>;
  limitations?: string[];
}) {
  const evidence = input.facts.map((fact, index) => ({
    id: `ev-${index + 1}`,
    type: "FACT" as const,
    statement: fact.statement,
    source: fact.source,
    confidence: 1,
    basis: fact.basis,
  }));

  const confidence = evidence.length === 0 ? 0 : 1;
  return referenceIntelligenceSchema.parse({
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    resolvedAt: new Date().toISOString(),
    evidence,
    decisions: [],
    confidence,
    limitations: input.limitations ?? [],
  });
}

export function appendDecision(
  intelligence: ReferenceIntelligence,
  decision: z.input<typeof decisionLogEntrySchema>,
): ReferenceIntelligence {
  return referenceIntelligenceSchema.parse({
    ...intelligence,
    decisions: [...intelligence.decisions, decision],
  });
}

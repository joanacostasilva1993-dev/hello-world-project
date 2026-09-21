import { z } from "zod";

export const opportunitySchema = z.object({
  id: z.string().min(1),
  gap: z.string().min(1),
  concept: z.string().min(1),
  whyDistinct: z.string().min(1),
  evidenceIds: z.array(z.string()),
  evidenceCount: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  hypothesis: z.string().min(1),
  nextTest: z.string().min(1),
});

export type ContentOpportunity = z.infer<typeof opportunitySchema>;

export function buildOpportunities(input: {
  gaps: string[];
  ideas: Array<{
    concept: string;
    why_it_is_distinct: string;
    reference_signal: string;
  }>;
  evidenceIds: string[];
}) {
  return input.ideas.map((idea, index) =>
    opportunitySchema.parse({
      id: `opp-${index + 1}`,
      gap: input.gaps[index % Math.max(input.gaps.length, 1)] ?? "Gap ainda não classificado",
      concept: idea.concept,
      whyDistinct: idea.why_it_is_distinct,
      evidenceIds: input.evidenceIds,
      evidenceCount: input.evidenceIds.length,
      confidence: Math.min(0.95, 0.45 + input.evidenceIds.length * 0.05),
      hypothesis: idea.reference_signal,
      nextTest: "Criar um primeiro conceito e medir retenção, satisfação e resposta da audiência.",
    }),
  );
}

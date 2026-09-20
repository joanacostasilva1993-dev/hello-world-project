import { z } from "zod";

import {
  PROVIDERS,
  providerDefinitionSchema,
  type ProviderDefinition,
} from "./provider.functions";
import { providerSelectionSchema, type ProviderSelection } from "./core.functions";

export const providerRouterDecisionSchema = z.object({
  capability: z.string(),
  selectedProviderId: z.string(),
  selectedProviderName: z.string(),
  reason: z.string(),
  candidates: z.array(
    z.object({
      providerId: z.string(),
      score: z.number(),
      eligible: z.boolean(),
      reasons: z.array(z.string()),
    }),
  ),
});

export type ProviderRouterDecision = z.infer<typeof providerRouterDecisionSchema>;

const capabilityPreferences: Record<string, string[]> = {
  llm: ["openrouter", "openai", "gemini", "opencode"],
  vision: ["openai", "gemini", "openrouter"],
  agents: ["openai", "opencode"],
  "image-generation": ["higgsfield"],
  "video-generation": ["higgsfield", "heygen"],
  avatars: ["heygen"],
  voice: ["heygen"],
  photos: ["pexels", "pixabay"],
  videos: ["pexels", "pixabay"],
  "stock-search": ["pexels", "pixabay"],
  design: ["canva"],
  timeline: ["drift"],
  render: ["drift"],
};

const statusScore: Record<ProviderDefinition["status"], number> = {
  ready: 100,
  local: 95,
  "needs-key": 70,
  planned: 10,
};

const executionScore: Record<ProviderDefinition["execution"], number> = {
  local: 20,
  cloud: 10,
  hybrid: 15,
};

export function rankProviders(selectionInput: ProviderSelection): ProviderRouterDecision {
  const selection = providerSelectionSchema.parse(selectionInput);
  const excluded = new Set(selection.excludedProviderIds);
  const candidates = PROVIDERS
    .filter((provider) => provider.capabilities.includes(selection.capability))
    .map((provider) => {
      const reasons: string[] = [];
      let score = statusScore[provider.status] + executionScore[provider.execution];

      if (excluded.has(provider.id)) {
        return {
          providerId: provider.id,
          score: -Infinity,
          eligible: false,
          reasons: ["Provider explicitamente excluído."],
        };
      }

      if (selection.preferredProviderId === provider.id) {
        score += 50;
        reasons.push("Provider preferido pelo utilizador ou workflow.");
      }

      if (provider.execution === selection.execution) {
        score += 20;
        reasons.push("Modo de execução compatível.");
      }

      if (selection.maxCostTier === "free" && provider.status === "needs-key") {
        score -= 25;
        reasons.push("Pode exigir credenciais ou custos externos.");
      }

      if (provider.status === "planned") {
        reasons.push("Adapter ainda não ligado ao runtime.");
      }

      if (provider.status === "ready") {
        reasons.push("Provider pronto para execução.");
      }

      if (provider.status === "local") {
        reasons.push("Execução local disponível.");
      }

      return {
        providerId: provider.id,
        score,
        eligible: provider.status !== "planned",
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);

  const eligible = candidates.filter((candidate) => candidate.eligible);
  if (!eligible.length) {
    throw new Error(
      `Não existe provider elegível para a capability "${selection.capability}".`,
    );
  }

  const winner = eligible[0];
  const provider = providerDefinitionSchema.parse(
    PROVIDERS.find((item) => item.id === winner.providerId),
  );

  return providerRouterDecisionSchema.parse({
    capability: selection.capability,
    selectedProviderId: provider.id,
    selectedProviderName: provider.name,
    reason: winner.reasons.join(" ") || "Maior pontuação entre os providers elegíveis.",
    candidates,
  });
}

export function resolveProvider(capability: string, options: Partial<ProviderSelection> = {}) {
  return rankProviders({
    capability,
    execution: options.execution ?? "hybrid",
    maxCostTier: options.maxCostTier ?? "low",
    excludedProviderIds: options.excludedProviderIds ?? [],
    ...(options.preferredProviderId
      ? { preferredProviderId: options.preferredProviderId }
      : {}),
  });
}

export function listCapabilityProviders(capability: string) {
  return PROVIDERS.filter((provider) => provider.capabilities.includes(capability));
}

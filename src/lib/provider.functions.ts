import { z } from "zod";

export const providerKindSchema = z.enum(["ai", "media", "analytics", "video", "audio", "design"]);
export const providerStatusSchema = z.enum(["ready", "needs-key", "planned", "local"]);

export const providerDefinitionSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  kind: providerKindSchema,
  status: providerStatusSchema,
  capabilities: z.array(z.string().min(1).max(80)).max(30),
  execution: z.enum(["cloud", "local", "hybrid"]),
  source: z.enum(["native", "plugin", "api", "open-source"]),
  notes: z.string().max(500).optional(),
});

export type ProviderDefinition = z.infer<typeof providerDefinitionSchema>;

/**
 * Provider registry: the application depends on capabilities, not vendor-specific
 * UI or SDKs. New providers can be added without rewriting the core engines.
 */
export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "ai",
    status: "needs-key",
    capabilities: ["llm", "vision", "routing", "fallbacks"],
    execution: "cloud",
    source: "api",
  },
  {
    id: "opencode",
    name: "OpenCode",
    kind: "ai",
    status: "planned",
    capabilities: ["agents", "local-tools", "model-bridge"],
    execution: "local",
    source: "open-source",
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "ai",
    status: "planned",
    capabilities: ["llm", "vision", "structured-output", "agents"],
    execution: "cloud",
    source: "api",
    notes: "Provider adapter planned; keep credentials server-side.",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    kind: "ai",
    status: "planned",
    capabilities: ["llm", "vision", "multimodal", "structured-output"],
    execution: "cloud",
    source: "api",
  },
  {
    id: "pexels",
    name: "Pexels",
    kind: "media",
    status: "needs-key",
    capabilities: ["photos", "videos", "stock-search"],
    execution: "cloud",
    source: "api",
  },
  {
    id: "pixabay",
    name: "Pixabay",
    kind: "media",
    status: "needs-key",
    capabilities: ["images", "videos", "stock-search"],
    execution: "cloud",
    source: "api",
  },
  {
    id: "youtube",
    name: "YouTube Data API",
    kind: "analytics",
    status: "needs-key",
    capabilities: ["channels", "videos", "playlists", "references"],
    execution: "cloud",
    source: "api",
  },
  {
    id: "canva",
    name: "Canva",
    kind: "design",
    status: "planned",
    capabilities: ["design", "templates", "brand-assets", "social-formats"],
    execution: "cloud",
    source: "plugin",
  },
  {
    id: "heygen",
    name: "HeyGen",
    kind: "video",
    status: "planned",
    capabilities: ["avatars", "voice", "video-generation", "translation"],
    execution: "cloud",
    source: "plugin",
  },
  {
    id: "higgsfield",
    name: "Higgsfield",
    kind: "video",
    status: "planned",
    capabilities: ["image-generation", "video-generation", "motion-graphics", "ugc"],
    execution: "cloud",
    source: "plugin",
  },
  {
    id: "drift",
    name: "Drift",
    kind: "video",
    status: "local",
    capabilities: ["timeline", "media", "text", "markers", "render"],
    execution: "local",
    source: "open-source",
  },
];

export function getProvidersByCapability(capability: string) {
  return PROVIDERS.filter((provider) => provider.capabilities.includes(capability));
}

export function getProvider(id: string) {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function validateProviderRegistry() {
  return z.array(providerDefinitionSchema).parse(PROVIDERS);
}

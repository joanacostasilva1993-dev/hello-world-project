export type ProviderStatus = "ready" | "needs-key" | "planned";

export type ProviderDefinition = {
  id: string;
  name: string;
  kind: "ai" | "media" | "analytics" | "video" | "audio";
  status: ProviderStatus;
  capabilities: string[];
};

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "ai",
    status: "needs-key",
    capabilities: ["LLM", "vision", "routing", "fallbacks"],
  },
  {
    id: "opencode",
    name: "OpenCode",
    kind: "ai",
    status: "planned",
    capabilities: ["agents", "local tools", "model bridge"],
  },
  {
    id: "youtube",
    name: "YouTube Data API",
    kind: "analytics",
    status: "needs-key",
    capabilities: ["channels", "videos", "playlists", "references"],
  },
  {
    id: "pexels",
    name: "Pexels",
    kind: "media",
    status: "needs-key",
    capabilities: ["photos", "videos"],
  },
  {
    id: "pixabay",
    name: "Pixabay",
    kind: "media",
    status: "needs-key",
    capabilities: ["images", "videos"],
  },
];

export type AIRoute = "fast" | "balanced" | "quality";

export type AIJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type AIRequest = {
  system?: string;
  prompt: string;
  route?: AIRoute;
  jsonSchema?: AIJsonSchema;
  temperature?: number;
};

export type AIUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
};

export type AIResult = {
  provider: "openrouter";
  model: string;
  content: string;
  usage?: AIUsage;
  requestId?: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey() {
  return process.env.OPENROUTER_API_KEY;
}

function getModel(route: AIRoute = "balanced") {
  const configured = {
    fast: process.env.OPENROUTER_MODEL_FAST,
    balanced: process.env.OPENROUTER_MODEL_BALANCED,
    quality: process.env.OPENROUTER_MODEL_QUALITY,
  }[route];

  return configured || process.env.OPENROUTER_MODEL || "openrouter/free";
}

function getFallbackModels() {
  return (process.env.OPENROUTER_MODEL_FALLBACKS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

export function getOpenRouterStatus() {
  return {
    configured: Boolean(getApiKey()),
    defaultModel: getModel("balanced"),
    fallbacks: getFallbackModels(),
    routes: {
      fast: getModel("fast"),
      balanced: getModel("balanced"),
      quality: getModel("quality"),
    },
  };
}

export async function runOpenRouter(request: AIRequest): Promise<AIResult> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY não está configurada no servidor.");
  }

  const model = getModel(request.route);
  const fallbackModels = getFallbackModels();
  const models = [...new Set([model, ...fallbackModels])];

  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(request.system ? [{ role: "system", content: request.system }] : []),
      { role: "user", content: request.prompt },
    ],
    temperature: request.temperature ?? 0.2,
  };

  if (models.length > 1) {
    body.models = models;
  }

  if (request.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: request.jsonSchema.name,
        strict: request.jsonSchema.strict ?? true,
        schema: request.jsonSchema.schema,
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "ViralFlow",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenRouter respondeu ${response.status}: ${detail.slice(0, 700)}`);
    }

    const payload = (await response.json()) as {
      id?: string;
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        cost?: number;
      };
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter devolveu uma resposta sem conteúdo.");
    }

    return {
      provider: "openrouter",
      model: payload.model ?? model,
      content,
      ...(payload.id ? { requestId: payload.id } : {}),
      ...(payload.usage
        ? {
            usage: {
              ...(payload.usage.prompt_tokens !== undefined
                ? { promptTokens: payload.usage.prompt_tokens }
                : {}),
              ...(payload.usage.completion_tokens !== undefined
                ? { completionTokens: payload.usage.completion_tokens }
                : {}),
              ...(payload.usage.total_tokens !== undefined
                ? { totalTokens: payload.usage.total_tokens }
                : {}),
              ...(payload.usage.cost !== undefined ? { cost: payload.usage.cost } : {}),
            },
          }
        : {}),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenRouter excedeu o timeout de 45 segundos.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export type AIRoute = "fast" | "balanced" | "quality";

export type AIRequest = {
  system?: string;
  prompt: string;
  route?: AIRoute;
};

export type AIResult = {
  provider: "openrouter";
  model: string;
  content: string;
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

export function getOpenRouterStatus() {
  return {
    configured: Boolean(getApiKey()),
    defaultModel: getModel("balanced"),
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

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "ViralFlow",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(request.system ? [{ role: "system", content: request.system }] : []),
        { role: "user", content: request.prompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenRouter respondeu ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter devolveu uma resposta sem conteúdo.");
  }

  return { provider: "openrouter", model, content };
}

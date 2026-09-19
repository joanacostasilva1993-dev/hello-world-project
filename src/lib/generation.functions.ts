import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const generationKindSchema = z.enum(["image", "video"]);

export type AssetGenerationRequest = {
  kind: "image" | "video";
  prompt: string;
  negativePrompt: string;
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  durationSeconds?: number;
  source: "storyboard-fallback";
  status: "queued";
};

const shotSchema = z.object({
  shot_type: z.string().max(200),
  composition: z.string().max(500),
  action: z.string().max(700),
  image_prompt: z.string().max(2000),
  video_prompt: z.string().max(2000),
  asset_type: z.enum(["image", "video", "mixed", "unknown"]).default("image"),
});

export const buildAssetGenerationRequest = createServerFn({ method: "POST" })
  .validator(z.object({
    shot: shotSchema,
    format: z.string().max(100).default("9:16 vertical"),
  }))
  .handler(async ({ data }): Promise<AssetGenerationRequest> => {
    const kind = data.shot.asset_type === "video" ? "video" : "image";
    const aspectRatio = inferAspectRatio(data.format, data.shot.composition);
    const prompt = kind === "video" ? data.shot.video_prompt : data.shot.image_prompt;

    return {
      kind,
      prompt: cleanPrompt(prompt),
      negativePrompt: "low quality, blurry, distorted anatomy, duplicated objects, unreadable text, watermark, logo, oversaturated, generic stock look",
      aspectRatio,
      durationSeconds: kind === "video" ? 5 : undefined,
      source: "storyboard-fallback",
      status: "queued",
    };
  });

function inferAspectRatio(format: string, composition: string): AssetGenerationRequest["aspectRatio"] {
  const value = (format + " " + composition).toLowerCase();
  if (value.includes("9:16") || value.includes("vertical") || value.includes("portrait")) return "9:16";
  if (value.includes("16:9") || value.includes("horizontal") || value.includes("landscape")) return "16:9";
  if (value.includes("4:5")) return "4:5";
  return "1:1";
}

function cleanPrompt(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^prompt\s*:\s*/i, "")
    .trim()
    .slice(0, 4000);
}

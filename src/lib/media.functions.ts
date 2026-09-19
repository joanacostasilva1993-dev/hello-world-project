import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchMedia } from "./media.server";

const shotSchema = z.object({
  shot_type: z.string().max(200),
  composition: z.string().max(500),
  action: z.string().max(700),
  image_prompt: z.string().max(2000),
  asset_type: z.enum(["image", "video", "mixed", "unknown"]).default("image"),
});

const mediaKindSchema = z.enum(["image", "video"]);

export const searchMediaAssets = createServerFn({ method: "POST" })
  .validator(z.object({
    query: z.string().min(2).max(200),
    providers: z.array(z.enum(["pexels", "pixabay"])).default(["pexels", "pixabay"]),
    perPage: z.number().int().min(1).max(20).default(8),
    kind: mediaKindSchema.default("image"),
  }))
  .handler(async ({ data }) => ({
    results: await searchMedia(data.query, data.providers, data.perPage, data.kind),
  }));

export const searchMediaForShot = createServerFn({ method: "POST" })
  .validator(z.object({
    shot: shotSchema,
    providers: z.array(z.enum(["pexels", "pixabay"])).default(["pexels", "pixabay"]),
    perPage: z.number().int().min(1).max(12).default(6),
  }))
  .handler(async ({ data }) => {
    const query = buildMediaQuery(data.shot);
    const kind = data.shot.asset_type === "video" ? "video" : "image";
    const orientation = inferOrientation(data.shot.composition);
    return {
      query,
      kind,
      orientation,
      results: await searchMedia(query, data.providers, data.perPage, kind, orientation),
    };
  });

function buildMediaQuery(shot: z.infer<typeof shotSchema>): string {
  const source = [shot.action, shot.shot_type, shot.composition, shot.image_prompt].filter(Boolean).join(" ");
  const cleaned = source.replace(/\[[^\]]+\]/g, " ").replace(/\([^)]*\)/g, " ").replace(/[{}|]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.split(/\s+/).filter(word => word.length > 2).slice(0, 24).join(" ").slice(0, 200) || "cinematic scene";
}

function inferOrientation(composition: string): "portrait"|"landscape"|"square"|undefined {
  const value=composition.toLowerCase();
  if (value.includes("vertical") || value.includes("portrait") || value.includes("9:16")) return "portrait";
  if (value.includes("horizontal") || value.includes("landscape") || value.includes("16:9")) return "landscape";
  if (value.includes("square") || value.includes("1:1")) return "square";
  return undefined;
}

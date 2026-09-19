import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchMedia, type MediaAsset } from "./media.server";

const shotSchema = z.object({
  shot_type: z.string().max(200),
  composition: z.string().max(500),
  action: z.string().max(700),
  image_prompt: z.string().max(2000),
  asset_type: z.enum(["image", "video", "mixed", "unknown"]).default("image"),
});

const mediaKindSchema = z.enum(["image", "video"]);

export type RankedMediaAsset = MediaAsset & {
  matchScore: number;
  matchReasons: string[];
  recommended: boolean;
};

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
    const results = await searchMedia(query, data.providers, data.perPage, kind, orientation);
    return {
      query,
      kind,
      orientation,
      results: results.map(result => ({
        ...result,
        assets: rankAssets(result.assets, data.shot, query),
      })),
    };
  });

function buildMediaQuery(shot: z.infer<typeof shotSchema>): string {
  const source = [shot.action, shot.shot_type, shot.composition, shot.image_prompt].filter(Boolean).join(" ");
  const cleaned = source.replace(/\[[^\]]+\]/g, " ").replace(/\([^)]*\)/g, " ").replace(/[{}|]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.split(/\s+/).filter(word => word.length > 2).slice(0, 24).join(" ").slice(0, 200) || "cinematic scene";
}

function inferOrientation(composition: string): "portrait" | "landscape" | "square" | undefined {
  const value = composition.toLowerCase();
  if (value.includes("vertical") || value.includes("portrait") || value.includes("9:16")) return "portrait";
  if (value.includes("horizontal") || value.includes("landscape") || value.includes("16:9")) return "landscape";
  if (value.includes("square") || value.includes("1:1")) return "square";
  return undefined;
}

function rankAssets(assets: MediaAsset[], shot: z.infer<typeof shotSchema>, query: string): RankedMediaAsset[] {
  const targetTokens = tokenize([shot.action, shot.shot_type, shot.composition, shot.image_prompt, query].join(" "));
  const targetOrientation = inferOrientation(shot.composition);
  const desiredKind = shot.asset_type === "video" ? "video" : "image";

  return assets
    .map(asset => {
      const searchable = tokenize([asset.title, ...(asset.tags ?? []), asset.author ?? ""].join(" "));
      const overlap = [...targetTokens].filter(token => searchable.has(token)).length;
      const semanticScore = Math.min(55, overlap * 11);
      const orientationScore = targetOrientation && asset.width && asset.height ? orientationMatch(targetOrientation, asset.width, asset.height) : 0;
      const typeScore = asset.type === desiredKind ? 15 : 0;
      const resolutionScore = asset.width && asset.height && Math.max(asset.width, asset.height) >= 1080 ? 10 : 4;
      const score = Math.min(100, semanticScore + orientationScore + typeScore + resolutionScore);
      const reasons: string[] = [];
      if (overlap > 0) reasons.push(`${overlap} sinais semânticos coincidem`);
      if (orientationScore >= 12) reasons.push("formato visual compatível");
      if (typeScore > 0) reasons.push(`tipo ${desiredKind} compatível`);
      if (resolutionScore >= 10) reasons.push("resolução adequada para produção");
      return { ...asset, matchScore: score, matchReasons: reasons.length ? reasons : ["resultado relevante do fornecedor"], recommended: false };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .map((asset, index) => ({ ...asset, recommended: index === 0 && asset.matchScore >= 45 }));
}

function tokenize(value: string): Set<string> {
  return new Set(value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(token => token.length >= 4));
}

function orientationMatch(orientation: "portrait" | "landscape" | "square", width: number, height: number): number {
  const ratio = width / height;
  if (orientation === "portrait") return ratio < 0.85 ? 15 : ratio < 1 ? 9 : 0;
  if (orientation === "landscape") return ratio > 1.5 ? 15 : ratio > 1.1 ? 9 : 0;
  return Math.abs(ratio - 1) < 0.12 ? 15 : Math.abs(ratio - 1) < 0.25 ? 8 : 0;
}

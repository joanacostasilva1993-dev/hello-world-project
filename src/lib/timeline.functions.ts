import { z } from "zod";

export const timelineTrackSchema = z.enum(["video", "audio", "text", "sfx"]);
export const timelineAssetSourceSchema = z.enum(["selected-media", "generated", "external", "none"]);

export const productionTimelineItemSchema = z.object({
  id: z.string().min(1).max(100),
  sceneId: z.string().min(1).max(100),
  order: z.number().int().nonnegative(),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive().max(600),
  track: timelineTrackSchema,
  visual: z.string().max(1200),
  narration: z.string().max(3000),
  onScreenText: z.string().max(500),
  sfx: z.string().max(500),
  transition: z.string().max(300),
  camera: z.string().max(500),
  assetSource: timelineAssetSourceSchema,
  assetId: z.string().max(300).optional(),
  assetUrl: z.string().url().max(2000).optional(),
  provider: z.string().max(100).optional(),
  generationKind: z.enum(["image", "video"]).optional(),
});

export const productionTimelineSchema = z.object({
  version: z.literal(1),
  projectId: z.string().min(1).max(120),
  title: z.string().max(300),
  format: z.string().max(100),
  fps: z.number().positive().max(120),
  items: z.array(productionTimelineItemSchema).max(500),
});

export type ProductionTimeline = z.infer<typeof productionTimelineSchema>;
export type ProductionTimelineItem = z.infer<typeof productionTimelineItemSchema>;

type SavedScriptScene = {
  time: string;
  visual: string;
  narration: string;
  on_screen_text: string;
  sfx: string;
  transition: string;
};

type SavedShot = {
  scene: string;
  time: string;
  shot_type: string;
  camera: string;
  composition: string;
  action: string;
  continuity: string;
  image_prompt: string;
  video_prompt: string;
  asset_type: string;
};

function parseTime(value: string, fallback: number): number {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?/i);
  return match ? Number(match[1]) : fallback;
}

function durationFromRange(value: string, fallback: number): { start: number; duration: number } {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/i);
  if (!match) return { start: parseTime(value, fallback), duration: 5 };
  const start = Number(match[1]);
  const end = Number(match[2]);
  return { start, duration: Math.max(0.5, end - start) };
}

export function buildProductionTimeline(
  title: string,
  format: string,
  scenes: SavedScriptScene[],
  shots: SavedShot[],
  selectedAssets: Record<number, { id: string; url: string; provider: string }>,
  generationQueue: Record<number, { kind: "image" | "video" }>,
): ProductionTimeline {
  const items: ProductionTimelineItem[] = [];
  let cursor = 0;

  scenes.forEach((scene, sceneIndex) => {
    const sceneId = `scene-${sceneIndex + 1}`;
    const sceneShots = shots
      .map((shot, shotIndex) => ({ shot, shotIndex }))
      .filter(({ shot }) => String(shot.scene) === String(sceneIndex + 1));

    const sceneStart = parseTime(scene.time, cursor);
    const fallbackShotDuration = sceneShots.length ? 5 / sceneShots.length : 5;

    sceneShots.forEach(({ shot, shotIndex }, localIndex) => {
      const fallbackStart = sceneStart + localIndex * fallbackShotDuration;
      const range = durationFromRange(shot.time, fallbackStart);
      const selected = selectedAssets[shotIndex];
      const generation = generationQueue[shotIndex];

      items.push({
        id: `${sceneId}-shot-${shotIndex + 1}`,
        sceneId,
        order: items.length,
        startSeconds: range.start,
        durationSeconds: range.duration,
        track: "video",
        visual: shot.action || scene.visual,
        narration: "",
        onScreenText: "",
        sfx: "",
        transition: shotIndex === sceneShots[sceneShots.length - 1]?.shotIndex ? scene.transition : "",
        camera: shot.camera || "",
        assetSource: selected ? "selected-media" : generation ? "generated" : "none",
        assetId: selected?.id,
        assetUrl: selected?.url,
        provider: selected?.provider,
        generationKind: generation?.kind,
      });
    });

    const sceneEnd = sceneShots.length
      ? Math.max(...sceneShots.map(({ shot }, index) => {
          const fallbackStart = sceneStart + index * fallbackShotDuration;
          const range = durationFromRange(shot.time, fallbackStart);
          return range.start + range.duration;
        }))
      : sceneStart + 5;

    if (scene.narration.trim()) {
      items.push({
        id: `${sceneId}-voice`,
        sceneId,
        order: items.length,
        startSeconds: sceneStart,
        durationSeconds: Math.max(0.5, sceneEnd - sceneStart),
        track: "audio",
        visual: "",
        narration: scene.narration,
        onScreenText: "",
        sfx: "",
        transition: "",
        camera: "",
        assetSource: "none",
      });
    }

    if (scene.on_screen_text.trim()) {
      items.push({
        id: `${sceneId}-text`,
        sceneId,
        order: items.length,
        startSeconds: sceneStart,
        durationSeconds: Math.max(0.5, sceneEnd - sceneStart),
        track: "text",
        visual: "",
        narration: "",
        onScreenText: scene.on_screen_text,
        sfx: "",
        transition: "",
        camera: "",
        assetSource: "none",
      });
    }

    if (scene.sfx.trim()) {
      items.push({
        id: `${sceneId}-sfx`,
        sceneId,
        order: items.length,
        startSeconds: sceneStart,
        durationSeconds: Math.max(0.5, Math.min(5, sceneEnd - sceneStart)),
        track: "sfx",
        visual: "",
        narration: "",
        onScreenText: "",
        sfx: scene.sfx,
        transition: "",
        camera: "",
        assetSource: "none",
      });
    }

    cursor = Math.max(cursor, sceneEnd);
  });

  return productionTimelineSchema.parse({
    version: 1,
    projectId: `viralflow-${Date.now()}`,
    title: title || "ViralFlow Production",
    format: format || "9:16 vertical",
    fps: 30,
    items,
  });
}

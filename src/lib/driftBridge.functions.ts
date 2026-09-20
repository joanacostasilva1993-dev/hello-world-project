import { z } from "zod";
import type { ProductionTimeline } from "./timeline.functions";

export const driftBridgeOperationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("import_media"), itemId: z.string(), url: z.string().url(), provider: z.string().optional() }),
  z.object({ operation: z.literal("place_clip"), itemId: z.string(), sourceAssetId: z.string(), startSeconds: z.number().nonnegative(), durationSeconds: z.number().positive(), track: z.enum(["video", "audio", "sfx"]) }),
  z.object({ operation: z.literal("add_text"), itemId: z.string(), text: z.string(), startSeconds: z.number().nonnegative(), durationSeconds: z.number().positive() }),
  z.object({ operation: z.literal("add_marker"), itemId: z.string(), label: z.string(), startSeconds: z.number().nonnegative() }),
]);

export type DriftBridgeOperation = z.infer<typeof driftBridgeOperationSchema>;
export const driftBridgeManifestSchema = z.object({
  version: z.literal(1),
  target: z.literal("drift"),
  source: z.literal("viralflow-production-contract"),
  projectId: z.string(),
  title: z.string(),
  format: z.string(),
  fps: z.number().positive(),
  operations: z.array(driftBridgeOperationSchema).max(1000),
});
export type DriftBridgeManifest = z.infer<typeof driftBridgeManifestSchema>;

export function buildDriftBridgeManifest(timeline: ProductionTimeline): DriftBridgeManifest {
  const operations: DriftBridgeOperation[] = [];
  for (const item of timeline.items) {
    if (item.assetUrl) {
      operations.push({ operation: "import_media", itemId: item.id, url: item.assetUrl, provider: item.provider });
      operations.push({
        operation: "place_clip",
        itemId: item.id,
        sourceAssetId: item.assetId || item.id,
        startSeconds: item.startSeconds,
        durationSeconds: item.durationSeconds,
        track: item.track === "video" ? "video" : item.track === "audio" ? "audio" : "sfx",
      });
    } else if (item.assetId && item.track !== "text") {
      operations.push({
        operation: "place_clip",
        itemId: item.id,
        sourceAssetId: item.assetId,
        startSeconds: item.startSeconds,
        durationSeconds: item.durationSeconds,
        track: item.track === "audio" ? "audio" : item.track === "video" ? "video" : "sfx",
      });
    }
    if (item.onScreenText.trim()) {
      operations.push({ operation: "add_text", itemId: item.id, text: item.onScreenText, startSeconds: item.startSeconds, durationSeconds: item.durationSeconds });
    }
    if (item.sfx.trim()) {
      operations.push({ operation: "add_marker", itemId: item.id, label: item.sfx, startSeconds: item.startSeconds });
    }
  }
  return driftBridgeManifestSchema.parse({
    version: 1,
    target: "drift",
    source: "viralflow-production-contract",
    projectId: timeline.projectId,
    title: timeline.title,
    format: timeline.format,
    fps: timeline.fps,
    operations,
  });
}

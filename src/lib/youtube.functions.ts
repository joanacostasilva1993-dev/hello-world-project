import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getYouTubeChannelByHandle,
  getYouTubeChannelSnapshot,
  getYouTubeChannelVideos,
  getYouTubeVideoSnapshot,
} from "./youtube.server";

export const youtubeReferenceSchema = z.object({
  mode: z.enum(["video", "channel"]),
  url: z.string().url(),
});

export function parseYouTubeUrl(url: string): { kind: "video"; videoId: string } | { kind: "channelHandle"; handle: string } | { kind: "channelId"; channelId: string } {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\\./, "").toLowerCase();
  if (host === "youtu.be") {
    const videoId = parsed.pathname.slice(1).split("/")[0];
    if (!videoId) throw new Error("URL do YouTube sem videoId.");
    return { kind: "video", videoId };
  }
  if (!host.endsWith("youtube.com")) throw new Error("URL não pertence ao YouTube.");
  const videoId = parsed.searchParams.get("v");
  if (videoId) return { kind: "video", videoId };
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts[0] === "shorts" && parts[1]) return { kind: "video", videoId: parts[1] };
  if (parts[0] === "live" && parts[1]) return { kind: "video", videoId: parts[1] };
  if (parts[0] === "@" && parts[1]) return { kind: "channelHandle", handle: "@" + parts[1] };
  if (parts[0]?.startsWith("@")) return { kind: "channelHandle", handle: parts[0] };
  if (parts[0] === "channel" && parts[1]) return { kind: "channelId", channelId: parts[1] };
  throw new Error("Não foi possível identificar um vídeo ou canal nesta URL do YouTube.");
}

export const resolveYouTubeReference = createServerFn({ method: "POST" })
  .validator(youtubeReferenceSchema)
  .handler(async ({ data }) => {
    const parsed = parseYouTubeUrl(data.url);
    if (data.mode === "video") {
      if (parsed.kind !== "video") throw new Error("A referência selecionada como vídeo não é uma URL de vídeo.");
      const video = await getYouTubeVideoSnapshot(parsed.videoId);
      return { kind: "video" as const, video, sourceUrl: data.url };
    }

    if (parsed.kind === "channelHandle") {
      const channel = await getYouTubeChannelByHandle(parsed.handle);
      const videos = await getYouTubeChannelVideos(channel.id, 12);
      return { kind: "channel" as const, channel, videos, sourceUrl: data.url };
    }
    if (parsed.kind === "channelId") {
      const channel = await getYouTubeChannelSnapshot(parsed.channelId);
      const videos = await getYouTubeChannelVideos(channel.id, 12);
      return { kind: "channel" as const, channel, videos, sourceUrl: data.url };
    }
    throw new Error("A referência selecionada como canal não é uma URL de canal.");
  });

const channelInputSchema = z.object({
  channelId: z.string().min(6).max(40),
  limit: z.number().int().min(1).max(24).default(12),
});

export const analyzeYouTubeChannelByHandle = createServerFn({ method: "POST" })
  .validator(
    z.object({
      handle: z.string().min(2).max(100),
      limit: z.number().int().min(1).max(24).default(12),
    }),
  )
  .handler(async ({ data }) => {
    const channel = await getYouTubeChannelByHandle(data.handle);
    const videos = await getYouTubeChannelVideos(channel.id, data.limit);
    return { channel, videos };
  });

export const analyzeYouTubeChannel = createServerFn({ method: "POST" })
  .validator(channelInputSchema)
  .handler(async ({ data }) => {
    const [channel, videos] = await Promise.all([
      getYouTubeChannelSnapshot(data.channelId),
      getYouTubeChannelVideos(data.channelId, data.limit),
    ]);

    return { channel, videos };
  });

export const analyzeYouTubeReference = createServerFn({ method: "POST" })
  .validator(
    z.object({
      videoId: z.string().min(6).max(20),
    }),
  )
  .handler(async ({ data }) => {
    return getYouTubeVideoSnapshot(data.videoId);
  });

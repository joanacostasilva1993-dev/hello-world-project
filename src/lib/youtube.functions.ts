import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getYouTubeChannelSnapshot, getYouTubeChannelVideos, getYouTubeVideoSnapshot } from "./youtube.server";

export const analyzeYouTubeChannel = createServerFn({ method: "POST" })
  .validator(z.object({ channelId: z.string().min(6).max(40), limit: z.number().int().min(1).max(24).default(12) }))
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

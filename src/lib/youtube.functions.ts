import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getYouTubeVideoSnapshot } from "./youtube.server";

export const analyzeYouTubeReference = createServerFn({ method: "POST" })
  .validator(
    z.object({
      videoId: z.string().min(6).max(20),
    }),
  )
  .handler(async ({ data }) => {
    return getYouTubeVideoSnapshot(data.videoId);
  });

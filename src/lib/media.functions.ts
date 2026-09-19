import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchMedia } from "./media.server";

export const searchMediaAssets = createServerFn({ method: "POST" })
 .validator(z.object({query:z.string().min(2).max(200),providers:z.array(z.enum(["pexels","pixabay"])).default(["pexels","pixabay"]),perPage:z.number().int().min(1).max(20).default(8)}))
 .handler(async({data})=>({results:await searchMedia(data.query,data.providers,data.perPage)}));

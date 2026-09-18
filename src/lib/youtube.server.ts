export type YouTubeVideoSnapshot = {
  kind: "video";
  id: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  duration?: string;
  tags: string[];
  categoryId?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  thumbnail?: string;
};

export type YouTubeChannelSnapshot = {
  kind: "channel";
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
  thumbnail?: string;
};

const API_URL = "https://www.googleapis.com/youtube/v3";

function getApiKey() {
  return process.env.YOUTUBE_API_KEY;
}

async function youtubeRequest(path: string, params: Record<string, string>) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("YOUTUBE_API_KEY não está configurada no servidor.");

  const query = new URLSearchParams({ ...params, key: apiKey });
  const response = await fetch(`${API_URL}/${path}?${query.toString()}`);

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`YouTube Data API respondeu ${response.status}: ${detail.slice(0, 400)}`);
  }

  return response.json() as Promise<any>;
}

export async function getYouTubeVideoSnapshot(videoId: string): Promise<YouTubeVideoSnapshot> {
  const data = await youtubeRequest("videos", {
    part: "snippet,contentDetails,statistics",
    id: videoId,
    maxResults: "1",
  });

  const item = data.items?.[0];
  if (!item) throw new Error("Vídeo não encontrado ou indisponível.");

  return {
    kind: "video",
    id: item.id,
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    channelId: item.snippet?.channelId ?? "",
    channelTitle: item.snippet?.channelTitle ?? "",
    publishedAt: item.snippet?.publishedAt ?? "",
    duration: item.contentDetails?.duration,
    tags: Array.isArray(item.snippet?.tags) ? item.snippet.tags : [],
    categoryId: item.snippet?.categoryId,
    viewCount: toNumber(item.statistics?.viewCount),
    likeCount: toNumber(item.statistics?.likeCount),
    commentCount: toNumber(item.statistics?.commentCount),
    thumbnail: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url,
  };
}

export async function getYouTubeChannelSnapshot(channelId: string): Promise<YouTubeChannelSnapshot> {
  const data = await youtubeRequest("channels", {
    part: "snippet,statistics",
    id: channelId,
    maxResults: "1",
  });

  const item = data.items?.[0];
  if (!item) throw new Error("Canal não encontrado ou indisponível.");

  return {
    kind: "channel",
    id: item.id,
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    publishedAt: item.snippet?.publishedAt ?? "",
    subscriberCount: toNumber(item.statistics?.subscriberCount),
    videoCount: toNumber(item.statistics?.videoCount),
    viewCount: toNumber(item.statistics?.viewCount),
    thumbnail: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url,
  };
}

function toNumber(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

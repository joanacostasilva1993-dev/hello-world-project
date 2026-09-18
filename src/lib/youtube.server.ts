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

export type YouTubeChannelVideo = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail?: string;
};

type YouTubeSnippet = {
  title?: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  categoryId?: string;
  tags?: string[];
  thumbnails?: {
    high?: { url?: string };
    medium?: { url?: string };
    default?: { url?: string };
  };
};

type YouTubeStatistics = {
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  subscriberCount?: string;
  videoCount?: string;
};

type YouTubeApiItem = {
  id?: string;
  snippet?: YouTubeSnippet;
  contentDetails?: {
    duration?: string;
  };
  statistics?: YouTubeStatistics;
};

type YouTubeSearchItem = {
  id?: {
    videoId?: string;
  };
  snippet?: YouTubeSnippet;
};

type YouTubeApiResponse = {
  items?: YouTubeApiItem[];
};

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[];
};

const API_URL = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string | undefined {
  return process.env.YOUTUBE_API_KEY;
}

async function youtubeRequest<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY não está configurada no servidor.");
  }

  const query = new URLSearchParams({ ...params, key: apiKey });
  const response = await fetch(API_URL + "/" + path + "?" + query.toString());

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      "YouTube Data API respondeu " +
        response.status +
        ": " +
        detail.slice(0, 400),
    );
  }

  return (await response.json()) as T;
}

export async function getYouTubeVideoSnapshot(
  videoId: string,
): Promise<YouTubeVideoSnapshot> {
  const data = await youtubeRequest<YouTubeApiResponse>("videos", {
    part: "snippet,contentDetails,statistics",
    id: videoId,
    maxResults: "1",
  });

  const item = data.items?.[0];

  if (!item?.id) {
    throw new Error("Vídeo não encontrado ou indisponível.");
  }

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
    thumbnail:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.default?.url,
  };
}

export async function getYouTubeChannelByHandle(
  handle: string,
): Promise<YouTubeChannelSnapshot> {
  const normalized = handle.replace(/^@/, "").trim();

  if (!normalized) {
    throw new Error("Handle do canal inválido.");
  }

  const data = await youtubeRequest<YouTubeApiResponse>("channels", {
    part: "snippet,statistics",
    forHandle: normalized,
    maxResults: "1",
  });

  return channelFromItem(
    data.items?.[0],
    "Canal não encontrado para este handle.",
  );
}

export async function getYouTubeChannelSnapshot(
  channelId: string,
): Promise<YouTubeChannelSnapshot> {
  const data = await youtubeRequest<YouTubeApiResponse>("channels", {
    part: "snippet,statistics",
    id: channelId,
    maxResults: "1",
  });

  return channelFromItem(
    data.items?.[0],
    "Canal não encontrado ou indisponível.",
  );
}

function channelFromItem(
  item: YouTubeApiItem | undefined,
  errorMessage: string,
): YouTubeChannelSnapshot {
  if (!item?.id) {
    throw new Error(errorMessage);
  }

  return {
    kind: "channel",
    id: item.id,
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    publishedAt: item.snippet?.publishedAt ?? "",
    subscriberCount: toNumber(item.statistics?.subscriberCount),
    videoCount: toNumber(item.statistics?.videoCount),
    viewCount: toNumber(item.statistics?.viewCount),
    thumbnail:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.default?.url,
  };
}

export async function getYouTubeChannelVideos(
  channelId: string,
  limit = 12,
): Promise<YouTubeChannelVideo[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const searchData = await youtubeRequest<YouTubeSearchResponse>("search", {
    part: "snippet",
    channelId,
    type: "video",
    order: "date",
    maxResults: String(safeLimit),
  });

  return (searchData.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;

      if (!videoId) {
        return null;
      }

      return {
        id: videoId,
        title: item.snippet?.title ?? "",
        publishedAt: item.snippet?.publishedAt ?? "",
        thumbnail:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url,
      };
    })
    .filter((item): item is YouTubeChannelVideo => item !== null);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

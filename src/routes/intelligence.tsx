import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  analyzeChannelIntelligence,
  analyzeContentReference,
  getAIProviderStatus,
} from "../lib/ai.functions";
import {
  analyzeYouTubeChannelByHandle,
  analyzeYouTubeChannel,
  analyzeYouTubeReference,
} from "../lib/youtube.functions";
import {
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Layers3,
  Search,
  Sparkles,
  Target,
  Users,
  Youtube,
} from "lucide-react";

export const Route = createFileRoute("/intelligence")({
  component: IntelligencePage,
});

type VideoMeta = {
  title: string;
  author: string;
  thumbnail: string;
  html: string;
};

type ChannelResult = {
  channel: {
    id: string;
    title: string;
    description: string;
    publishedAt: string;
    subscriberCount?: number;
    videoCount?: number;
    viewCount?: number;
    thumbnail?: string;
    uploadsPlaylistId?: string;
  };
  videos: Array<{
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
    engagementRate?: number;
    estimatedViewsPerDay?: number;
    thumbnail?: string;
  }>;
};

function extractVideoId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (url.hostname.includes("youtube.com")) {
      return (
        url.searchParams.get("v") ||
        url.pathname.split("/").filter(Boolean).pop() ||
        ""
      );
    }
  } catch {
    return "";
  }
  return "";
}

function extractChannelReference(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("@")) {
    return { kind: "handle" as const, value: trimmed.split(/[/?#]/)[0] };
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.includes("youtube.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const atIndex = parts.findIndex((part) => part.startsWith("@"));
    if (atIndex >= 0) {
      return { kind: "handle" as const, value: parts[atIndex].split(/[/?#]/)[0] };
    }
    if (parts[0] === "channel" && parts[1]) {
      return { kind: "channelId" as const, value: parts[1] };
    }
  } catch {
    return null;
  }

  return null;
}

function IntelligencePage() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"video" | "channel">("video");
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [channelResult, setChannelResult] = useState<ChannelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    defaultModel: string;
  } | null>(null);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [channelAiResult, setChannelAiResult] = useState<Record<string, unknown> | null>(null);
  const [youtubeSnapshot, setYoutubeSnapshot] = useState<Record<string, unknown> | null>(null);

  async function analyze() {
    setMessage("");
    setMeta(null);
    setChannelResult(null);
    setAiResult(null);
    setChannelAiResult(null);
    setYoutubeSnapshot(null);

    if (!url.trim()) {
      setMessage("Cole uma URL do YouTube para começar.");
      return;
    }

    setLoading(true);

    try {
      const provider = await getAIProviderStatus();
      setAiStatus(provider);

      if (mode === "channel") {
        const reference = extractChannelReference(url);

        if (!reference) {
          setMessage(
            "Use https://youtube.com/@canal ou https://youtube.com/channel/CHANNEL_ID.",
          );
          return;
        }

        const result =
          reference.kind === "handle"
            ? await analyzeYouTubeChannelByHandle({
                data: { handle: reference.value, limit: 12 },
              })
            : await analyzeYouTubeChannel({
                data: { channelId: reference.value, limit: 12 },
              });

        setChannelResult(result);

        if (provider.configured && result.videos.length > 0) {
          const analysis = await analyzeChannelIntelligence({
            data: {
              channel: result.channel,
              videos: result.videos,
              route: "balanced",
            },
          });
          setChannelAiResult(analysis.parsed);
        }

        return;
      }

      const videoId = extractVideoId(url.trim());
      if (!videoId) {
        setMessage("Não consegui identificar um vídeo do YouTube nessa URL.");
        return;
      }

      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      );

      if (!response.ok) throw new Error("oEmbed indisponível");

      const data = (await response.json()) as VideoMeta;
      setMeta(data);

      try {
        const snapshot = await analyzeYouTubeReference({ data: { videoId } });
        setYoutubeSnapshot(snapshot as unknown as Record<string, unknown>);

        if (provider.configured) {
          const analysis = await analyzeContentReference({
            data: {
              title: snapshot.title,
              author: snapshot.channelTitle,
              url: url.trim(),
              route: "balanced",
              snapshot,
            },
          });
          setAiResult(analysis.parsed);
        }
      } catch {
        if (provider.configured) {
          const analysis = await analyzeContentReference({
            data: {
              title: data.title,
              author: data.author,
              url: url.trim(),
              route: "balanced",
            },
          });
          setAiResult(analysis.parsed);
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "A análise não conseguiu concluir.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <Link
              to="/"
              className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Command Center
            </Link>
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <BrainCircuit className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  ViralFlow · Intelligence
                </p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  YouTube Reference Intelligence
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Converta referências públicas em sinais estruturados para alimentar
              ideias, hooks e roteiros.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Provider
            </p>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold">
              <Youtube className="size-4 text-primary" /> YouTube
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Search className="size-5 text-primary" />
              <h2 className="text-lg font-black">Reference Analyzer</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Analise um vídeo individual ou construa o primeiro Channel DNA a
              partir de um canal público.
            </p>

            <div className="mt-5 flex rounded-xl border border-border bg-muted/30 p-1">
              <button
                onClick={() => setMode("video")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
                  mode === "video" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                Vídeo
              </button>
              <button
                onClick={() => setMode("channel")}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${
                  mode === "channel" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                Canal
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyze()}
                placeholder={
                  mode === "video"
                    ? "https://youtube.com/watch?v=..."
                    : "https://youtube.com/@canal"
                }
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={analyze}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                <Sparkles className="size-4" />{" "}
                {loading ? "A analisar..." : "Analisar"}
              </button>
            </div>

            {message && (
              <div className="mt-4 flex gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{message}</span>
              </div>
            )}

            {channelResult && <ChannelDna result={channelResult} />}

            {channelAiResult && (
              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="size-4 text-primary" />
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    AI Channel DNA
                  </p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <DnaValue label="Posicionamento" value={channelAiResult.channel_positioning} />
                  <DnaValue label="Sinal de audiência" value={channelAiResult.audience_signal} />
                  <DnaValue label="Cadência" value={channelAiResult.publishing_pattern} />
                  <DnaValue label="Formatos recorrentes" value={channelAiResult.standout_formats} />
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <InsightList title="Pilares de conteúdo" values={channelAiResult.content_pillars} />
                  <InsightList title="Padrões de títulos" values={channelAiResult.title_patterns} />
                  <InsightList title="Sinais de oportunidade" values={channelAiResult.opportunity_signals} />
                  <InsightList title="Hipóteses a validar" values={channelAiResult.hypotheses_to_validate} />
                </div>
              </div>
            )}

            {aiResult && (
              <>
                <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                      AI Content DNA
                    </p>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <DnaValue label="Hook" value={aiResult.hook} />
                    <DnaValue label="Promessa" value={aiResult.promise} />
                    <DnaValue label="Tema" value={aiResult.topic} />
                    <DnaValue
                      label="Padrão narrativo"
                      value={aiResult.narrative_pattern}
                    />
                  </div>
                </div>

                <section className="mt-5 grid gap-4 lg:grid-cols-3">
                  <InsightList
                    title="Mecânicas de retenção"
                    values={aiResult.retention_mechanics}
                  />
                  <InsightList
                    title="Sinais de packaging"
                    values={aiResult.packaging_signals}
                  />
                  <InsightList
                    title="Ângulos de conteúdo"
                    values={aiResult.content_angles}
                  />
                  <InsightList title="Oportunidades" values={aiResult.opportunities} />
                  <InsightList title="Hooks alternativos" values={aiResult.hook_variants} />
                  <InsightList
                    title="Hipóteses a validar"
                    values={aiResult.hypotheses_to_verify}
                  />
                </section>
              </>
            )}

            {youtubeSnapshot && (
              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  YouTube Data API · Snapshot
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DnaValue label="Views" value={formatNumber(youtubeSnapshot.viewCount)} />
                  <DnaValue label="Likes" value={formatNumber(youtubeSnapshot.likeCount)} />
                  <DnaValue
                    label="Comentários"
                    value={formatNumber(youtubeSnapshot.commentCount)}
                  />
                  <DnaValue
                    label="Tags"
                    value={
                      Array.isArray(youtubeSnapshot.tags)
                        ? String(youtubeSnapshot.tags.length)
                        : "—"
                    }
                  />
                </div>
              </div>
            )}

            {meta && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
                <img src={meta.thumbnail} alt="" className="aspect-video w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">
                        Public metadata · YouTube oEmbed
                      </p>
                      <h3 className="mt-1 text-base font-black">{meta.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{meta.author}</p>
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Connection readiness
            </p>
            <h2 className="mt-1 text-lg font-black">Providers</h2>
            <div className="mt-4 space-y-3">
              <ProviderRow icon={Youtube} name="YouTube Data API" status="API key necessária" />
              <ProviderRow
                icon={BrainCircuit}
                name="OpenRouter"
                status={
                  aiStatus?.configured
                    ? `Ligado · ${aiStatus.defaultModel}`
                    : "API key necessária"
                }
              />
              <ProviderRow icon={Layers3} name="OpenCode" status="Agente opcional" />
              <ProviderRow icon={BarChart3} name="Analytics" status="Próxima fase" />
            </div>
            <div className="mt-5 rounded-2xl bg-muted/30 p-4">
              <p className="text-xs font-bold">Regra de segurança</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                As chaves dos providers deverão ficar no servidor. Nunca serão
                gravadas no código do frontend.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <DnaCard
            title="Content DNA"
            icon={Target}
            items={[
              "Hook e promessa",
              "Estrutura narrativa",
              "Curiosity gap",
              "Mecanismos de retenção",
            ]}
          />
          <DnaCard
            title="Visual & Packaging DNA"
            icon={Layers3}
            items={[
              "Linguagem visual",
              "Ritmo de cortes",
              "Padrões de título",
              "CTA / payoff",
            ]}
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <LockedCard
            title="Opportunity Map"
            detail="Será calculado a partir de referências analisadas e clusters de conteúdo."
          />
          <LockedCard
            title="Reference Radar"
            detail="Vai comparar padrões entre canais, vídeos e temas guardados."
          />
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
            <p className="text-sm font-black">Channel DNA</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Agora ativo: canal, volume publicado e amostra das referências
              recentes já podem alimentar a próxima camada de inteligência.
            </p>
            <span className="mt-4 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
              Ligação ativa
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}

function ChannelDna({ result }: { result: ChannelResult }) {
  const { channel, videos } = result;
  const avgPerVideo =
    channel.videoCount && channel.videoCount > 0 && channel.viewCount !== undefined
      ? Math.round(channel.viewCount / channel.videoCount)
      : undefined;

  return (
    <div className="mt-5 overflow-hidden rounded-3xl border border-primary/20 bg-primary/5">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {channel.thumbnail ? (
          <img
            src={channel.thumbnail}
            alt=""
            className="size-16 rounded-2xl object-cover"
          />
        ) : (
          <div className="grid size-16 place-items-center rounded-2xl bg-background">
            <Users className="size-6 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Channel DNA · YouTube Data API
          </p>
          <h3 className="mt-1 truncate text-lg font-black">{channel.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {channel.description || "Sem descrição pública disponível."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-primary/10 p-5 sm:grid-cols-4">
        <DnaValue label="Subscritores" value={formatNumber(channel.subscriberCount)} />
        <DnaValue label="Vídeos" value={formatNumber(channel.videoCount)} />
        <DnaValue label="Views totais" value={formatNumber(channel.viewCount)} />
        <DnaValue label="Views/vídeo" value={formatNumber(avgPerVideo)} />
      </div>

      <div className="border-t border-primary/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-primary">
              Reference Feed
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Últimas referências públicas devolvidas pelo canal.
            </p>
          </div>
          <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold">
            {videos.length} vídeos
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          {videos.map((video, index) => (
            <div
              key={video.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3"
            >
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt=""
                  className="aspect-video w-28 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="grid aspect-video w-28 shrink-0 place-items-center rounded-xl bg-muted">
                  <Youtube className="size-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-primary">#{index + 1}</p>
                <p className="line-clamp-2 text-xs font-bold">{video.title}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  <span>{new Intl.DateTimeFormat("pt-PT").format(new Date(video.publishedAt))}</span>
                  <span>{formatNumber(video.viewCount)} views</span>
                  {video.engagementRate !== undefined && (
                    <span>{(video.engagementRate * 100).toFixed(2)}% engagement</span>
                  )}
                  {video.estimatedViewsPerDay !== undefined && (
                    <span>{formatCompact(video.estimatedViewsPerDay)}/dia estimadas</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProviderRow({
  icon: Icon,
  name,
  status,
}: {
  icon: typeof Youtube;
  name: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
      <div className="grid size-9 place-items-center rounded-xl bg-muted">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{name}</p>
        <p className="text-[11px] text-muted-foreground">{status}</p>
      </div>
      <span className="size-2 rounded-full bg-muted-foreground/40" />
    </div>
  );
}

function DnaCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Target;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-primary" />
        <h2 className="font-black">{title}</h2>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center gap-2 rounded-xl bg-muted/25 px-3 py-3 text-xs font-semibold text-muted-foreground"
          >
            <CheckCircle2 className="size-4 text-primary/60" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatNumber(value: unknown) {
  return typeof value === "number"
    ? new Intl.NumberFormat("pt-PT").format(value)
    : "—";
}

function formatCompact(value: unknown) {
  return typeof value === "number"
    ? new Intl.NumberFormat("pt-PT", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value)
    : "—";
}

function InsightList({ title, values }: { title: string; values: unknown }) {
  const items = Array.isArray(values)
    ? values.filter((item): item is string => typeof item === "string")
    : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-black uppercase tracking-wider text-primary">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-xl bg-muted/25 px-3 py-2 text-xs leading-5"
            >
              {item}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Sem dados suficientes.</p>
        )}
      </div>
    </div>
  );
}

function DnaValue({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xs leading-5">
        {typeof value === "string" || typeof value === "number" ? value : "—"}
      </p>
    </div>
  );
}

function LockedCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 p-5">
      <p className="text-sm font-black">{title}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      <span className="mt-4 inline-flex rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
        Próxima camada
      </span>
    </div>
  );
}

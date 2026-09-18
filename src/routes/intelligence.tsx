import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { analyzeContentReference, getAIProviderStatus } from "../lib/ai.functions";
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

function extractVideoId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop() || "";
    }
  } catch {
    return "";
  }
  return "";
}

function IntelligencePage() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"video" | "channel">("video");
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; defaultModel: string } | null>(null);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);

  async function analyze() {
    setMessage("");
    setMeta(null);
    setAiResult(null);
    if (!url.trim()) {
      setMessage("Cole uma URL do YouTube para começar.");
      return;
    }
    if (mode === "channel") {
      setMessage("Análise de canais requer a ligação do YouTube Data API. A estrutura já está preparada para essa ligação.");
      return;
    }

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      setMessage("Não consegui identificar um vídeo do YouTube nessa URL.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`);
      if (!response.ok) throw new Error("oEmbed indisponível");
      const data = (await response.json()) as VideoMeta;
      setMeta(data);
      try {
        const provider = await getAIProviderStatus();
        setAiStatus(provider);
        if (provider.configured) {
          const analysis = await analyzeContentReference({
            data: { title: data.title, author: data.author, url: url.trim(), route: "balanced" },
          });
          setAiResult(analysis.parsed);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "A análise AI falhou.");
      }
    } catch {
      setMessage("Não foi possível obter os metadados públicos deste vídeo. Verifique a URL e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <Link to="/" className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Command Center
            </Link>
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <BrainCircuit className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ViralFlow · Intelligence</p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">YouTube Reference Intelligence</h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Converta referências públicas em sinais estruturados para alimentar ideias, hooks e roteiros.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Provider</p>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold"><Youtube className="size-4 text-primary" /> YouTube</div>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Search className="size-5 text-primary" />
              <h2 className="text-lg font-black">Reference Analyzer</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Comece por um vídeo público ou, depois de ligar a API, por um canal.</p>

            <div className="mt-5 flex rounded-xl border border-border bg-muted/30 p-1">
              <button onClick={() => setMode("video")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${mode === "video" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Vídeo</button>
              <button onClick={() => setMode("channel")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${mode === "channel" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Canal</button>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyze()} placeholder={mode === "video" ? "https://youtube.com/watch?v=..." : "https://youtube.com/@canal"} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <button onClick={analyze} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60">
                <Sparkles className="size-4" /> {loading ? "A analisar..." : "Analisar"}
              </button>
            </div>

            {message && (
              <div className="mt-4 flex gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{message}</span>
              </div>
            )}

            {aiResult && (
              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">AI Content DNA</p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <DnaValue label="Hook" value={aiResult.hook} />
                  <DnaValue label="Promessa" value={aiResult.promise} />
                  <DnaValue label="Tema" value={aiResult.topic} />
                  <DnaValue label="Padrão narrativo" value={aiResult.narrative_pattern} />
                </div>
              </div>
            )}

            {meta && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
                <img src={meta.thumbnail} alt="" className="aspect-video w-full object-cover" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">Public metadata · YouTube oEmbed</p>
                      <h3 className="mt-1 text-base font-black">{meta.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{meta.author}</p>
                    </div>
                    <a href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"><ExternalLink className="size-4" /></a>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Connection readiness</p>
            <h2 className="mt-1 text-lg font-black">Providers</h2>
            <div className="mt-4 space-y-3">
              <ProviderRow icon={Youtube} name="YouTube Data API" status="API key necessária" />
              <ProviderRow icon={BrainCircuit} name="OpenRouter" status={aiStatus?.configured ? `Ligado · ${aiStatus.defaultModel}` : "API key necessária"} />
              <ProviderRow icon={Layers3} name="OpenCode" status="Agente opcional" />
              <ProviderRow icon={BarChart3} name="Analytics" status="Próxima fase" />
            </div>
            <div className="mt-5 rounded-2xl bg-muted/30 p-4">
              <p className="text-xs font-bold">Regra de segurança</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">As chaves dos providers deverão ficar no servidor. Nunca serão gravadas no código do frontend.</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <DnaCard title="Content DNA" icon={Target} items={["Hook e promessa", "Estrutura narrativa", "Curiosity gap", "Mecanismos de retenção"]} />
          <DnaCard title="Visual & Packaging DNA" icon={Layers3} items={["Linguagem visual", "Ritmo de cortes", "Padrões de título", "CTA / payoff"]} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <LockedCard title="Channel DNA" detail="Requer YouTube Data API para recolher e comparar vídeos do canal." />
          <LockedCard title="Opportunity Map" detail="Será calculado a partir de referências analisadas e clusters de conteúdo." />
          <LockedCard title="Reference Radar" detail="Vai comparar padrões entre canais, vídeos e temas guardados." />
        </section>
      </div>
    </main>
  );
}

function ProviderRow({ icon: Icon, name, status }: { icon: typeof Youtube; name: string; status: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-border p-3"><div className="grid size-9 place-items-center rounded-xl bg-muted"><Icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{name}</p><p className="text-[11px] text-muted-foreground">{status}</p></div><span className="size-2 rounded-full bg-muted-foreground/40" /></div>;
}

function DnaCard({ title, icon: Icon, items }: { title: string; icon: typeof Target; items: string[] }) {
  return <div className="rounded-3xl border border-border bg-card p-5"><div className="flex items-center gap-2"><Icon className="size-5 text-primary" /><h2 className="font-black">{title}</h2></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{items.map((item) => <div key={item} className="flex items-center gap-2 rounded-xl bg-muted/25 px-3 py-3 text-xs font-semibold text-muted-foreground"><CheckCircle2 className="size-4 text-primary/60" />{item}</div>)}</div></div>;
}

function DnaValue({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-xl border border-border bg-background p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xs leading-5">{typeof value === "string" ? value : "—"}</p></div>;
}

function LockedCard({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-3xl border border-dashed border-border bg-card/60 p-5"><p className="text-sm font-black">{title}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p><span className="mt-4 inline-flex rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">Provider necessário</span></div>;
}

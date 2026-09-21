import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  ChevronRight,
  Clapperboard,
  FileText,
  FlaskConical,
  Gauge,
  Lightbulb,
  Menu,
  Play,
  Radio,
  Search,
  Sparkles,
  Target,
  WandSparkles,
  X,
  Youtube,
} from "lucide-react";
import { useState } from "react";\n\nimport { analyzeChannelIntelligence, analyzeContentReference } from "@/lib/ai.functions";
import { resolveYouTubeReference } from "@/lib/youtube.functions";\n

import { createEventBus } from "@/lib/eventBus.functions";
import { runWorkflow } from "@/lib/workflowRuntime.functions";
import type { Workflow } from "@/lib/workflow.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

const pipeline = [
  { label: "Research", icon: Search, state: "active" },
  { label: "Intelligence", icon: BrainCircuit, state: "next" },
  { label: "Ideas", icon: Lightbulb, state: "next" },
  { label: "Hooks", icon: Target, state: "next" },
  { label: "Scripts", icon: FileText, state: "next" },
  { label: "Storyboard", icon: Clapperboard, state: "next" },
  { label: "Production", icon: WandSparkles, state: "next" },
  { label: "Analytics", icon: BarChart3, state: "next" },
  { label: "Learning", icon: FlaskConical, state: "next" },
];

const references = [
  { title: "The hidden reason videos explode", source: "YouTube", type: "Reference", signal: "Hook + retention" },
  { title: "Why nobody talks about this niche", source: "YouTube", type: "Channel DNA", signal: "Pattern detected" },
  { title: "The 3-second curiosity gap", source: "YouTube", type: "Reference", signal: "Opening structure" },
];

function Index() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"video" | "channel">("video");
  const [analyzed, setAnalyzed] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, string>>({});
  const [eventCount, setEventCount] = useState(0);
  const [intelligence, setIntelligence] = useState<Record<string, unknown> | null>(null);

  async function runReferenceAnalysis() {
    setIsRunning(true);
    setRunStatus("running");
    setAnalyzed(false);
    setNodeStatuses({});
    setEventCount(0);
    setIntelligence(null);

    const workflow: Workflow = {
      id: "reference-intelligence-v2",
      name: "YouTube Reference Intelligence",
      version: 2,
      nodes: [
        { id: "input", type: "project.input", label: "Reference input" },
        { id: "research", type: "research.run", label: "Resolve + analyze source" },
        { id: "originality", type: "originality.check", label: "Originality readiness" },
      ],
      edges: [
        { from: "input", to: "research" },
        { from: "research", to: "originality" },
      ],
    };

    const eventBus = createEventBus();
    const unsubscribe = eventBus.subscribe((event) => {
      setEventCount(eventBus.history().length);
      if (event.type === "WORKFLOW_NODE_STARTED" || event.type === "WORKFLOW_NODE_COMPLETED") {
        const nodeId = typeof event.payload.nodeId === "string" ? event.payload.nodeId : undefined;
        if (nodeId) setNodeStatuses((current) => ({ ...current, [nodeId]: event.type === "WORKFLOW_NODE_STARTED" ? "running" : "completed" }));
      }
    });

    try {
      const result = await runWorkflow(
        workflow,
        "viralflow-command-center",
        { referenceUrl, mode: analysisMode },
        {
          eventBus,
          handlers: {
            "project.input": async () => ({
              output: { referenceUrl, mode: analysisMode },
              eventType: "PROJECT_CREATED",
              eventPayload: { referenceUrl, mode: analysisMode },
            }),
            "research.run": async () => {
              const resolved = await resolveYouTubeReference({ data: { mode: analysisMode, url: referenceUrl } });
              if (resolved.kind === "video") {
                const analysis = await analyzeContentReference({ data: {
                  title: resolved.video.title,
                  author: resolved.video.channelTitle,
                  url: resolved.sourceUrl,
                  route: "balanced",
                  snapshot: {
                    title: resolved.video.title,
                    description: resolved.video.description,
                    channelTitle: resolved.video.channelTitle,
                    publishedAt: resolved.video.publishedAt,
                    duration: resolved.video.duration,
                    tags: resolved.video.tags,
                    viewCount: resolved.video.viewCount,
                    likeCount: resolved.video.likeCount,
                    commentCount: resolved.video.commentCount,
                  },
                } });
                return {
                  output: { source: resolved, intelligence: analysis.parsed, provider: analysis.provider, model: analysis.model, usage: analysis.usage },
                  eventType: "RESEARCH_COMPLETED",
                  eventPayload: { sourceKind: "video", provider: analysis.provider, model: analysis.model, contentDna: analysis.parsed },
                };
              }

              const analysis = await analyzeChannelIntelligence({ data: {
                channel: resolved.channel,
                videos: resolved.videos,
                route: "balanced",
              } });
              return {
                output: { source: resolved, intelligence: analysis.parsed, provider: analysis.provider, model: analysis.model, usage: analysis.usage },
                eventType: "RESEARCH_COMPLETED",
                eventPayload: { sourceKind: "channel", provider: analysis.provider, model: analysis.model, channelDna: analysis.parsed },
              };
            },
            "originality.check": async (_node, context) => ({
              output: { status: "ready-for-originality-engine", source: context.outputs.research?.source ? "resolved" : "missing" },
            }),
          },
        },
      );

      const researchOutput = result.context.outputs.research as { intelligence?: Record<string, unknown> } | undefined;
      setIntelligence(researchOutput?.intelligence ?? null);
      setRunStatus(result.run.status === "completed" ? "completed" : "failed");
      setAnalyzed(result.run.status === "completed");
      setEventCount(result.context.events.length);
    } catch {
      setRunStatus("failed");
      setAnalyzed(false);
    } finally {
      unsubscribe();
      setIsRunning(false);
    }
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card/95 backdrop-blur-xl transition-transform lg:static lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col p-5">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xl font-black tracking-tight">
                  <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <Radio className="size-5" />
                  </div>
                  Viral<span className="text-primary">Flow</span>
                </div>
                <p className="mt-1 pl-11 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Content Intelligence OS
                </p>
              </div>
              <button className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
                <X className="size-5" />
              </button>
            </div>

            <nav className="space-y-1">
              <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
              <NavItem icon={Gauge} label="Command Center" active />
              <NavItem icon={BrainCircuit} label="Intelligence" to="/intelligence" />
              <NavItem icon={Lightbulb} label="Ideation" to="/ideas" />
              <NavItem icon={FileText} label="Script Studio" />
              <NavItem icon={Clapperboard} label="Production" />
              <NavItem icon={BarChart3} label="Analytics" />
            </nav>

            <div className="mt-auto rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Sparkles className="size-4 text-primary" />
                Intelligence Engine
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Transforme referências em padrões, ideias, hooks e roteiros com uma cadeia de inteligência conectada.
              </p>
              <button className="mt-4 flex w-full items-center justify-between rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground">
                Configurar motor
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
                <Menu className="size-5" />
              </button>
              <div className="hidden lg:block">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
                <h1 className="text-sm font-bold">ViralFlow Command Center</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground sm:inline-flex">
                  Engine: <strong className="ml-1 text-foreground">Ready</strong>
                </span>
                <button onClick={() => document.getElementById("intelligence")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm">
                  <Sparkles className="size-4" />
                  Nova análise
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
            <section className="overflow-hidden rounded-3xl border border-border bg-card">
              <div className="relative p-6 sm:p-8">
                <div className="absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative max-w-3xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <Activity className="size-3.5" />
                    Content Intelligence OS
                  </div>
                  <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                    De referências soltas para uma máquina de conteúdo.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    O Command Center conecta pesquisa, inteligência, ideação, roteiro, produção e aprendizagem num único pipeline.
                  </p>
                </div>
              </div>

              <div className="grid border-t border-border sm:grid-cols-3 lg:grid-cols-9">
                {pipeline.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="group border-b border-r border-border p-3 last:border-r-0 lg:border-b-0">
                      <div className="flex items-center gap-2 lg:block">
                        <div className={`mb-0 flex size-8 shrink-0 items-center justify-center rounded-lg lg:mb-3 ${
                          index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold">{item.label}</p>
                          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                            {index === 0 ? "Current" : index < 4 ? "Next" : "Pipeline"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section id="intelligence" className="rounded-3xl border border-primary/20 bg-card p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Step 2 · Intelligence Engine</p>
                  <h3 className="mt-1 text-xl font-black">Transforme uma referência em Content DNA.</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Insira um vídeo ou canal. Esta camada prepara a estrutura para extrair hook, promessa, narrativa, sinais visuais e padrões de retenção.</p>
                </div>
                <div className="flex rounded-xl border border-border bg-muted/40 p-1">
                  <button onClick={() => setAnalysisMode("video")} className={`rounded-lg px-3 py-2 text-xs font-bold ${analysisMode === "video" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Vídeo</button>
                  <button onClick={() => setAnalysisMode("channel")} className={`rounded-lg px-3 py-2 text-xs font-bold ${analysisMode === "channel" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Canal</button>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Youtube className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} placeholder={analysisMode === "video" ? "Cole a URL de um vídeo do YouTube..." : "Cole a URL de um canal do YouTube..."} className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
                <button onClick={runReferenceAnalysis} disabled={!referenceUrl.trim() || isRunning} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                  <BrainCircuit className="size-4" />
                  Analisar referência
                </button>
              </div>
              {(isRunning || runStatus !== "idle") && (
                <div className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">Workflow Runtime</p>
                      <p className="mt-1 text-sm font-bold">
                        {runStatus === "running" ? "Pipeline em execução" : runStatus === "completed" ? "Pipeline concluído" : "Pipeline terminou com falha"}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {eventCount} eventos
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {(["input", "research", "originality"] as const).map((nodeId) => (
                      <div key={nodeId} className="rounded-xl border border-border bg-background p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{nodeId}</p>
                        <p className="mt-1 text-xs font-black">{nodeStatuses[nodeId] ?? "queued"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analyzed ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InsightCard label="Hook" value={String(intelligence?.hook ?? intelligence?.channel_positioning ?? "Não extraído")} detail={String(intelligence?.promise ?? intelligence?.audience_signal ?? "Sinal da fonte")} />
                  <InsightCard label="Estrutura" value={String(intelligence?.narrative_pattern ?? "Em análise")} detail={Array.isArray(intelligence?.content_pillars) ? intelligence.content_pillars.slice(0, 2).join(" · ") : "Padrão narrativo observado"} />
                  <InsightCard label="Visual DNA" value={Array.isArray(intelligence?.visual_signals) ? String(intelligence.visual_signals.length) + " sinais" : "Ainda não extraído"} detail={Array.isArray(intelligence?.visual_signals) ? intelligence.visual_signals.slice(0, 2).join(" · ") : "Requer análise multimodal"} />
                  <InsightCard label="Oportunidades" value={Array.isArray(intelligence?.opportunities ?? intelligence?.opportunity_signals) ? String((intelligence?.opportunities ?? intelligence?.opportunity_signals as unknown[]).length) : "0"} detail={Array.isArray(intelligence?.opportunities) ? intelligence.opportunities.slice(0, 2).join(" · ") : Array.isArray(intelligence?.opportunity_signals) ? intelligence.opportunity_signals.slice(0, 2).join(" · ") : "Sem oportunidades calculadas"} />
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center">
                  <BrainCircuit className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">Nenhuma referência analisada</p>
                  <p className="mt-1 text-xs text-muted-foreground">O resultado será a base para gerar oportunidades, hooks e roteiros.</p>
                </div>
              )}
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <MetricCard icon={BrainCircuit} label="Intelligence" value={runStatus === "completed" ? "Executed" : "Ready"} detail="Workflow Runtime conectado" />
              <MetricCard icon={Youtube} label="References" value={analyzed ? "1" : "0"} detail={analyzed ? "Referência processada" : "Adicione o primeiro vídeo ou canal"} />
              <MetricCard icon={Lightbulb} label="Ideas" value="0" detail="Próxima etapa: oportunidades" />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="rounded-3xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border p-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reference Intelligence</p>
                    <h3 className="mt-1 text-lg font-black">Radar de referências</h3>
                  </div>
                  <button onClick={() => document.getElementById("intelligence")?.scrollIntoView({ behavior: "smooth" })} className="text-xs font-bold text-primary">Nova análise</button>
                </div>
                <div className="divide-y divide-border">
                  {references.map((reference) => (
                    <div key={reference.title} className="flex items-center gap-4 p-5">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                        <Youtube className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{reference.title}</p>
                        <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
                          <span>{reference.type}</span><span>•</span><span>{reference.signal}</span>
                        </div>
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Start</p>
                <h3 className="mt-1 text-lg font-black">Comece pelo sinal certo.</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Analise um vídeo ou canal de referência para desbloquear o DNA de conteúdo antes de gerar ideias.
                </p>
                <div className="mt-5 space-y-2">
                  <ActionRow icon={Search} title="Analisar referência" detail="Vídeo, canal ou URL" />
                  <ActionRow icon={BrainCircuit} title="Extrair Content DNA" detail="Hook, estrutura, visual e retenção" />
                  <ActionRow icon={Lightbulb} title="Gerar oportunidades" detail="Ângulos derivados da inteligência" />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-dashed border-border bg-muted/20 p-6 text-center sm:p-10">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-card shadow-sm">
                <Play className="size-5 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-black">O próximo movimento começa aqui.</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Este primeiro Command Center estabelece a arquitetura visual. O próximo passo liga a inteligência a dados reais e transforma referências em análises acionáveis.
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false, to }: { icon: typeof Gauge; label: string; active?: boolean; to?: "/" | "/intelligence" | "/ideas" }) {
  const className = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;
  if (to) return <Link to={to} className={className}><Icon className="size-4" />{label}</Link>;
  return <button className={className}><Icon className="size-4" />{label}</button>;
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Gauge; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="grid size-9 place-items-center rounded-xl bg-muted"><Icon className="size-4" /></div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="mt-5 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function InsightCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span><span className="size-1.5 rounded-full bg-primary" /></div>
      <p className="mt-3 text-sm font-black">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ActionRow({ icon: Icon, title, detail }: { icon: typeof Search; title: string; detail: string }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary/40 hover:bg-muted/40">
      <div className="grid size-9 place-items-center rounded-lg bg-muted"><Icon className="size-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold">{title}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}

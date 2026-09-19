import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clapperboard, Download, Layers3, RefreshCw, Sparkles } from "lucide-react";
import { buildProductionTimeline, type ProductionTimeline } from "../lib/timeline.functions";

export const Route = createFileRoute("/timeline")({ component: TimelinePage });

function TimelinePage() {
  const [timeline, setTimeline] = useState<ProductionTimeline | null>(null);
  const [message, setMessage] = useState("");

  function rebuild() {
    try {
      const script = JSON.parse(localStorage.getItem("viralflow.lastScript") || "null");
      const shots = JSON.parse(localStorage.getItem("viralflow.storyboard") || "[]");
      const assets = JSON.parse(localStorage.getItem("viralflow.storyboardAssets") || "{}");
      const generation = JSON.parse(localStorage.getItem("viralflow.generationQueue") || "{}");
      if (!script?.scenes?.length) {
        setMessage("Cria primeiro um roteiro no Script Engine.");
        return;
      }
      const result = buildProductionTimeline(
        String(script.title || ""),
        String(script.format || "9:16 vertical"),
        script.scenes,
        Array.isArray(shots) ? shots : [],
        assets,
        generation,
      );
      setTimeline(result);
      localStorage.setItem("viralflow.productionTimeline", JSON.stringify(result));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível construir a timeline.");
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("viralflow.productionTimeline");
      if (saved) setTimeline(JSON.parse(saved));
    } catch {}
  }, []);

  const duration = useMemo(
    () => timeline ? Math.max(0, ...timeline.items.map((item) => item.startSeconds + item.durationSeconds)) : 0,
    [timeline],
  );

  function exportJson() {
    if (!timeline) return;
    const blob = new Blob([JSON.stringify(timeline, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "viralflow-production-timeline.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-border pb-6">
        <Link to="/storyboard" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Storyboard Engine</Link>
        <div className="mt-4 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><Layers3 className="size-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ViralFlow · Production OS</p><h1 className="text-2xl font-black sm:text-3xl">Universal Production Timeline</h1></div></div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">O contrato universal entre roteiro, storyboard, assets e futuros editores. A timeline não pertence ao Drift: pertence ao projeto ViralFlow.</p>
      </header>

      <section className="mt-6 flex flex-wrap gap-3">
        <button onClick={rebuild} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground"><RefreshCw className="size-4" /> Construir timeline</button>
        <button onClick={exportJson} disabled={!timeline} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-bold disabled:opacity-40"><Download className="size-4" /> Exportar contrato JSON</button>
      </section>

      {message && <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs">{message}</div>}

      {timeline ? <div className="mt-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Projeto" value={timeline.title} />
          <Metric label="Formato" value={timeline.format} />
          <Metric label="Duração" value={duration.toFixed(1) + "s"} />
          <Metric label="Elementos" value={String(timeline.items.length)} />
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><p className="text-sm font-black">Production Contract v1</p></div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Cada item tem identidade, tempo, track, conteúdo, transição, câmara e origem do asset. Isto permite criar adaptadores para Drift/CutWire, FFmpeg ou outros editores sem alterar o pipeline.</p>
        </div>
        <div className="space-y-3">{timeline.items.map(item => <article key={item.id} className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[120px_90px_1fr_auto]">
          <div><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Tempo</p><p className="mt-1 text-sm font-black text-primary">{item.startSeconds.toFixed(1)}s → {(item.startSeconds + item.durationSeconds).toFixed(1)}s</p></div>
          <div><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Track</p><p className="mt-1 text-xs font-bold uppercase">{item.track}</p></div>
          <div><p className="text-xs font-black">{item.sceneId}</p><p className="mt-1 text-xs leading-5">{item.visual || item.sfx || item.narration}</p><p className="mt-2 text-[10px] text-muted-foreground">{item.narration ? "VO · " + item.narration.slice(0, 120) : ""}{item.onScreenText ? " · Texto · " + item.onScreenText : ""}</p></div>
          <div className="text-right"><span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black text-primary">{item.assetSource}</span>{item.provider && <p className="mt-2 text-[9px] text-muted-foreground">{item.provider}</p>}</div>
        </article>)}</div>
      </div> : <div className="mt-6 grid min-h-[480px] place-items-center rounded-3xl border border-dashed p-8 text-center"><div><Clapperboard className="mx-auto size-9 text-primary" /><h2 className="mt-4 font-black">Timeline Workspace</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">Constrói o contrato universal a partir do último roteiro, storyboard, media selecionada e pedidos de geração.</p></div></div>}
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 truncate text-sm font-black">{value}</p></div>;
}

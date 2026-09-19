import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clipboard, Download, ExternalLink, FileJson, RefreshCw } from "lucide-react";
import { buildDriftBridgeManifest, type DriftBridgeManifest } from "../lib/driftBridge.functions";
import type { ProductionTimeline } from "../lib/timeline.functions";

export const Route = createFileRoute("/drift")({ component: DriftBridgePage });

function DriftBridgePage() {
  const [manifest, setManifest] = useState<DriftBridgeManifest | null>(null);
  const [message, setMessage] = useState("");

  function build() {
    try {
      const saved = localStorage.getItem("viralflow.productionTimeline");
      if (!saved) {
        setMessage("Constrói primeiro a Universal Production Timeline.");
        return;
      }
      const timeline = JSON.parse(saved) as ProductionTimeline;
      setManifest(buildDriftBridgeManifest(timeline));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível preparar a ponte Drift.");
    }
  }

  useEffect(() => {
    build();
  }, []);

  function exportJson() {
    if (!manifest) return;
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "viralflow-drift-bridge.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyManifest() {
    if (!manifest) return;
    await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
    setMessage("Manifesto copiado para a área de transferência.");
  }

  const counts = manifest?.operations.reduce<Record<string, number>>((acc, op) => {
    acc[op.operation] = (acc[op.operation] || 0) + 1;
    return acc;
  }, {}) || {};

  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-border pb-6">
        <Link to="/timeline" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Production Timeline</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><ExternalLink className="size-5" /></div>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ViralFlow · Integration Layer</p><h1 className="text-2xl font-black sm:text-3xl">Drift / CutWire Bridge</h1></div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Converte o Production Contract num manifesto neutro de operações. A execução no editor fica desacoplada do ViralFlow, permitindo trocar Drift, FFmpeg ou outro backend sem reconstruir o projeto.</p>
      </header>

      <section className="mt-6 flex flex-wrap gap-3">
        <button onClick={build} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground"><RefreshCw className="size-4" /> Preparar bridge</button>
        <button onClick={exportJson} disabled={!manifest} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-bold disabled:opacity-40"><Download className="size-4" /> Exportar manifesto</button>
        <button onClick={copyManifest} disabled={!manifest} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-bold disabled:opacity-40"><Clipboard className="size-4" /> Copiar JSON</button>
      </section>

      {message && <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs">{message}</div>}

      {manifest ? <div className="mt-6 space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Target" value="Drift" />
          <Metric label="FPS" value={String(manifest.fps)} />
          <Metric label="Operações" value={String(manifest.operations.length)} />
          <Metric label="Importações" value={String(counts.import_media || 0)} />
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /><p className="text-sm font-black">Adapter Layer ativo</p></div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Este passo não tenta fingir que o browser consegue controlar o editor local. Primeiro produzimos um contrato determinístico; depois ligamos um executor MCP/local que traduz estas operações para as ferramentas disponíveis no Drift.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2"><FileJson className="size-4 text-primary" /><p className="text-sm font-black">Manifesto</p></div>
            <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl bg-muted p-4 text-[10px] leading-5">{JSON.stringify(manifest, null, 2)}</pre>
          </div>
          <div className="space-y-3">
            {Object.entries(counts).map(([name, count]) => <div key={name} className="rounded-2xl border border-border bg-card p-4"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{name}</p><p className="mt-2 text-2xl font-black">{count}</p></div>)}
            <div className="rounded-2xl border border-dashed p-5">
              <p className="text-sm font-black">Próximo encaixe</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Executor local → MCP do Drift → importação → colocação/trim → texto/marcadores → exportação. A ponte atual já deixa o contrato preparado para esse executor.</p>
            </div>
          </div>
        </div>
      </div> : <div className="mt-6 grid min-h-[420px] place-items-center rounded-3xl border border-dashed p-8 text-center"><div><ExternalLink className="mx-auto size-9 text-primary" /><h2 className="mt-4 font-black">Drift Bridge</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">Constrói primeiro uma Production Timeline para gerar o manifesto de integração.</p></div></div>}
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 truncate text-sm font-black">{value}</p></div>;
}

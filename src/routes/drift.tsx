import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clipboard, Download, ExternalLink, FileJson, ListChecks, RefreshCw } from "lucide-react";
import { buildDriftBridgeManifest, type DriftBridgeManifest } from "../lib/driftBridge.functions";
import { buildDriftMcpExecutionPlan, type DriftMcpExecutionPlan } from "../lib/driftExecutor.functions";
import { checkLocalBridge, callLocalBridge, localBridgeJobSchema, type LocalBridgeJob } from "../lib/localBridge.functions";
import type { ProductionTimeline } from "../lib/timeline.functions";

export const Route = createFileRoute("/drift")({ component: DriftBridgePage });

function DriftBridgePage() {
  const [manifest, setManifest] = useState<DriftBridgeManifest | null>(null);
  const [plan, setPlan] = useState<DriftMcpExecutionPlan | null>(null);
  const [message, setMessage] = useState("");
  const [bridge, setBridge] = useState<"unknown" | "online" | "offline">("unknown");
  const [job, setJob] = useState<LocalBridgeJob | null>(null);
  const [running, setRunning] = useState(false);

  function build() {
    try {
      const saved = localStorage.getItem("viralflow.productionTimeline");
      if (!saved) {
        setMessage("Constrói primeiro a Universal Production Timeline.");
        return;
      }

      const timeline = JSON.parse(saved) as ProductionTimeline;
      const nextManifest = buildDriftBridgeManifest(timeline);
      setManifest(nextManifest);
      setPlan(buildDriftMcpExecutionPlan(nextManifest));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível preparar a ponte Drift.");
    }
  }

  useEffect(() => {
    build();
    checkLocalBridge().then((response) => {
      if (response.type === "health") setBridge("online");
    }).catch(() => setBridge("offline"));
  }, []);

  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await callLocalBridge({ command: "status", jobId: job.id });
        if (response.type === "job") setJob(localBridgeJobSchema.parse(response.job));
      } catch {
        setBridge("offline");
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  function downloadJson(filename: string, value: unknown) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    if (!manifest) return;
    downloadJson("viralflow-drift-bridge.json", manifest);
  }

  function exportPlan() {
    if (!plan) return;
    downloadJson("viralflow-drift-mcp-plan.json", plan);
  }

  async function healthCheck() {
    try {
      const response = await checkLocalBridge();
      setBridge(response.type === "health" ? "online" : "offline");
      setMessage(response.type === "health" ? `Local Bridge online · v${response.bridgeVersion} · ${response.driftConnected ? "Drift ligado" : "Dry Run"}.` : "Local Bridge respondeu com erro.");
    } catch (error) {
      setBridge("offline");
      setMessage(error instanceof Error ? error.message : "Local Bridge indisponível.");
    }
  }

  async function startDryRun() {
    if (!plan) return;
    setRunning(true);
    try {
      const response = await callLocalBridge({ command: "start", plan });
      if (response.type === "job") {
        setJob(response.job);
        setBridge("online");
        setMessage("Dry Run iniciado. O bridge está a percorrer o plano sem alterar o Drift.");
      }
    } catch (error) {
      setBridge("offline");
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar o Dry Run.");
    } finally {
      setRunning(false);
    }
  }

  async function cancelJob() {
    if (!job) return;
    try {
      const response = await callLocalBridge({ command: "cancel", jobId: job.id });
      if (response.type === "job") setJob(response.job);
      setMessage("Job cancelado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cancelar o job.");
    }
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
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Converte o Production Contract num manifesto e, agora, num plano de execução MCP. A execução real continua isolada num bridge local/desktop para não expor o controlo do Drift ao browser.</p>
      </header>

      <section className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={build} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground"><RefreshCw className="size-4" /> Preparar bridge</button>
        <button type="button" onClick={healthCheck} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-bold"><span className={bridge === "online" ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-muted-foreground"} /> Health Check</button>
        <button type="button" onClick={startDryRun} disabled={!plan || running || job?.status === "running"} className="inline-flex items-center gap-2 rounded-xl border border-primary/40 px-4 py-3 text-xs font-bold disabled:opacity-40"><ListChecks className="size-4" /> Iniciar Dry Run</button>
        {job?.status === "running" && <button type="button" onClick={cancelJob} className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-3 text-xs font-bold">Cancelar</button>}
        <button type="button" onClick={exportJson} disabled={!manifest} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-bold disabled:opacity-40"><Download className="size-4" /> Exportar manifesto</button>
        <button type="button" onClick={exportPlan} disabled={!plan} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-bold disabled:opacity-40"><ListChecks className="size-4" /> Exportar plano MCP</button>
        <button type="button" onClick={copyManifest} disabled={!manifest} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-bold disabled:opacity-40"><Clipboard className="size-4" /> Copiar JSON</button>
      </section>

      {message && <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs">{message}</div>}

      {job && <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-black">Local Bridge · {job.status}</p><p className="mt-1 text-[10px] text-muted-foreground">{job.currentStep} / {job.totalSteps} passos</p></div>
          <div className="h-2 w-48 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: \`${job.totalSteps ? Math.round(job.currentStep / job.totalSteps * 100) : 0}%\` }} /></div>
        </div>
      </div>}

      {manifest && plan ? <div className="mt-6 space-y-5">
        <div className="grid gap-3 sm:grid-cols-5">
          <Metric label="Target" value="Drift" />
          <Metric label="FPS" value={String(manifest.fps)} />
          <Metric label="Operações" value={String(manifest.operations.length)} />
          <Metric label="Passos MCP" value={String(plan.steps.length)} />
          <Metric label="Importações" value={String(counts.import_media || 0)} />
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /><p className="text-sm font-black">Executor contract preparado</p></div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">O ViralFlow já sabe a sequência que um executor local deve cumprir: descobrir ferramentas → importar → obter IDs reais → colocar clips → overlays/marcadores → verificar. Isto prepara a próxima camada sem fingir que o browser controla o processo local.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2"><FileJson className="size-4 text-primary" /><p className="text-sm font-black">Manifesto</p></div>
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-2xl bg-muted p-4 text-[10px] leading-5">{JSON.stringify(manifest, null, 2)}</pre>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2"><ListChecks className="size-4 text-primary" /><p className="text-sm font-black">Plano MCP</p></div>
            <div className="mt-4 space-y-2">
              {plan.steps.map((step, index) => <div key={index + "-" + step.itemId} className="rounded-2xl border border-border p-3">
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-wider text-primary">{step.phase}</p><span className="text-[9px] text-muted-foreground">{step.tool}</span></div>
                <p className="mt-1 text-xs font-bold">{step.operation} · {step.itemId}</p>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{step.note}</p>
              </div>)}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5">
          <p className="text-sm font-black">Arquitetura da próxima camada</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">ViralFlow Web → Desktop/Local Bridge → Drift MCP → projeto Drift. O bridge local será responsável por materializar assets, proteger o token MCP, executar batches e confirmar os IDs reais devolvidos pelo editor.</p>
        </div>
      </div> : <div className="mt-6 grid min-h-[420px] place-items-center rounded-3xl border border-dashed p-8 text-center"><div><ExternalLink className="mx-auto size-9 text-primary" /><h2 className="mt-4 font-black">Drift Bridge</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">Constrói primeiro uma Production Timeline para gerar o manifesto de integração.</p></div></div>}
    </div>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 truncate text-sm font-black">{value}</p></div>;
}

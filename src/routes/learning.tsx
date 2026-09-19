import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BrainCircuit, FlaskConical, Plus, RefreshCw, Trash2 } from "lucide-react";
import { buildLearningReport, type PerformanceInput, type LearningReport, type Platform } from "../lib/learning.functions";

export const Route = createFileRoute("/learning")({ component: LearningPage });

const emptyRow: PerformanceInput = {
  platform: "youtube", contentId: "", title: "", publishedAt: "", views: 0,
  retentionPercent: undefined, likes: 0, comments: 0, shares: 0, saves: 0,
  followersGained: 0, hookVariant: "", topic: "", format: "",
};

function LearningPage() {
  const [rows, setRows] = useState<PerformanceInput[]>([{ ...emptyRow }]);
  const [report, setReport] = useState<LearningReport | null>(null);
  const [message, setMessage] = useState("");
  const validRows = useMemo(() => rows.filter(r => r.contentId.trim()), [rows]);

  function generate() {
    if (!validRows.length) { setMessage("Adiciona pelo menos um conteúdo com um ID ou nome."); return; }
    try {
      const result = buildLearningReport(validRows);
      setReport(result);
      localStorage.setItem("viralflow.learningReport", JSON.stringify(result));
      localStorage.setItem("viralflow.performanceData", JSON.stringify(validRows));
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível gerar o relatório."); }
  }

  function addRow() { setRows(current => [...current, { ...emptyRow, contentId: "content-" + (current.length + 1) }]); }
  function update(index: number, key: keyof PerformanceInput, value: string) {
    setRows(current => current.map((row, i) => {
      if (i !== index) return row;
      const numeric = ["views","retentionPercent","likes","comments","shares","saves","followersGained","watchTimeSeconds","averageViewDurationSeconds","durationSeconds"].includes(key);
      return { ...row, [key]: numeric ? (value === "" ? undefined : Number(value)) : value };
    }));
  }

  return <main className="min-h-screen bg-background text-foreground"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="border-b border-border pb-6">
      <Link to="/intelligence" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Intelligence</Link>
      <div className="mt-4 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><BrainCircuit className="size-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ViralFlow · Learning Loop</p><h1 className="text-2xl font-black sm:text-3xl">Algorithm Signal Engine</h1></div></div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Transforma métricas reais do próprio canal em sinais comparáveis, hipóteses e experiências. O motor não tenta adivinhar nem reproduzir os sistemas internos das plataformas.</p>
    </header>
    <section className="mt-6 flex flex-wrap gap-3">
      <button onClick={addRow} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground"><Plus className="size-4" /> Adicionar conteúdo</button>
      <button onClick={generate} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs font-bold"><RefreshCw className="size-4" /> Gerar learning report</button>
    </section>
    {message && <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs">{message}</div>}
    <div className="mt-6 overflow-x-auto rounded-3xl border border-border bg-card"><table className="w-full min-w-[1050px] text-left text-xs">
      <thead><tr className="border-b border-border text-[9px] uppercase tracking-wider text-muted-foreground"><th className="p-3">Conteúdo</th><th className="p-3">Plataforma</th><th className="p-3">Views</th><th className="p-3">Retenção %</th><th className="p-3">Likes</th><th className="p-3">Shares</th><th className="p-3">Hook</th><th className="p-3"></th></tr></thead>
      <tbody>{rows.map((row,index)=><tr key={index} className="border-b border-border/70 last:border-0">
        <td className="p-2"><input value={row.contentId} onChange={e=>update(index,"contentId",e.target.value)} className="w-32 rounded-lg border border-border bg-background px-2 py-2" /></td>
        <td className="p-2"><select value={row.platform} onChange={e=>update(index,"platform",e.target.value as Platform)} className="rounded-lg border border-border bg-background px-2 py-2"><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option></select></td>
        <td className="p-2"><input type="number" value={row.views ?? ""} onChange={e=>update(index,"views",e.target.value)} className="w-24 rounded-lg border border-border bg-background px-2 py-2" /></td>
        <td className="p-2"><input type="number" value={row.retentionPercent ?? ""} onChange={e=>update(index,"retentionPercent",e.target.value)} className="w-24 rounded-lg border border-border bg-background px-2 py-2" /></td>
        <td className="p-2"><input type="number" value={row.likes ?? ""} onChange={e=>update(index,"likes",e.target.value)} className="w-24 rounded-lg border border-border bg-background px-2 py-2" /></td>
        <td className="p-2"><input type="number" value={row.shares ?? ""} onChange={e=>update(index,"shares",e.target.value)} className="w-24 rounded-lg border border-border bg-background px-2 py-2" /></td>
        <td className="p-2"><input value={row.hookVariant ?? ""} onChange={e=>update(index,"hookVariant",e.target.value)} className="w-44 rounded-lg border border-border bg-background px-2 py-2" placeholder="Hook A" /></td>
        <td className="p-2"><button onClick={()=>setRows(current=>current.filter((_,i)=>i!==index))} className="rounded-lg p-2 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></td>
      </tr>)}</tbody>
    </table></div>
    {report && <section className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-4"><Metric label="Amostra" value={String(report.sampleSize)} /><Metric label="Plataforma" value={report.platform} /><Metric label="Confiança interna" value={report.confidence} /><Metric label="Sinais" value={String(report.signals.length)} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sinais observados"><div className="grid gap-2">{report.signals.map(s=><div key={s.name} className="rounded-xl bg-muted/30 p-3"><div className="flex justify-between gap-3"><span className="text-xs font-bold">{s.name}</span><span className="text-xs font-black text-primary">{s.value.toFixed(2)} {s.unit}</span></div><p className="mt-1 text-[11px] text-muted-foreground">{s.interpretation}</p></div>)}</div></Panel>
        <Panel title="Padrões fortes"><List values={report.strongestPatterns} /></Panel>
        <Panel title="Padrões fracos / limites"><List values={report.weakPatterns} /></Panel>
        <Panel title="Experimentos seguintes"><List values={report.experimentsToRun} /></Panel>
      </div>
      <div className="rounded-3xl border border-border bg-card p-5"><div className="flex items-center gap-2"><FlaskConical className="size-4 text-primary" /><p className="text-sm font-black">Learning Loop</p></div><p className="mt-2 text-xs leading-5 text-muted-foreground">O próximo ciclo poderá consumir este relatório automaticamente para alimentar Idea Engine, Hook Lab e Script Engine, mantendo hipóteses e resultados ligados ao histórico do canal.</p></div>
    </section>}
  </div></main>;
}

function Metric({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-sm font-black">{value}</p></div>; }
function Panel({title,children}:{title:string;children:React.ReactNode}) { return <div className="rounded-3xl border border-border bg-card p-5"><p className="text-sm font-black">{title}</p><div className="mt-3">{children}</div></div>; }
function List({values}:{values:string[]}) { return <div className="space-y-2">{values.map((v,i)=><div key={i} className="rounded-xl bg-muted/30 p-3 text-xs leading-5">{v}</div>)}</div>; }

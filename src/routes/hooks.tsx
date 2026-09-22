import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CircleAlert, Copy, Flame, Loader2, Sparkles, Target, FileText } from "lucide-react";
import { generateHooks } from "../lib/hooks.functions";

export const Route = createFileRoute("/hooks")({ component: HooksPage });

type SavedIdea = {
  concept:string; angle:string; promise:string; audience:string; format:string; hook:string;
  differentiation:string; validation:string; savedAt:string;
};

type Hook = {
  id:string; text:string; mechanism:string; promise:string; payoff:string;
  evidenceIds:string[]; originalityNotes:string[]; confidence:number; testVariantGroup:string;
};

const HOOKS_KEY = "viralflow.savedHooks";
const SELECTED_HOOK_KEY = "viralflow.selectedHook";

function HooksPage() {
  const [savedIdeas,setSavedIdeas]=useState<SavedIdea[]>([]);
  const [selected,setSelected]=useState<SavedIdea|null>(null);
  const [hooks,setHooks]=useState<Hook[]>([]);
  const [savedHooks,setSavedHooks]=useState<Hook[]>([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [learningContext,setLearningContext]=useState({strongestPatterns:[] as string[],weakPatterns:[] as string[],experimentsToRun:[] as string[]});

  useEffect(()=>{
    try {
      const raw=localStorage.getItem("viralflow.savedIdeas");
      if(raw) setSavedIdeas(JSON.parse(raw));
      const savedRaw=localStorage.getItem(HOOKS_KEY);
      if(savedRaw) setSavedHooks(JSON.parse(savedRaw));
      const reportRaw=localStorage.getItem("viralflow.learningReport");
      if(reportRaw){
        const report=JSON.parse(reportRaw) as Partial<typeof learningContext>;
        setLearningContext({
          strongestPatterns:Array.isArray(report.strongestPatterns)?report.strongestPatterns:[],
          weakPatterns:Array.isArray(report.weakPatterns)?report.weakPatterns:[],
          experimentsToRun:Array.isArray(report.experimentsToRun)?report.experimentsToRun:[],
        });
      }
    } catch {
      setMessage("Não foi possível carregar os dados guardados localmente.");
    }
  },[]);

  async function generate() {
    if(!selected) return;
    setLoading(true); setMessage(""); setHooks([]);
    try {
      const opportunity = {
        id: `idea:${selected.concept}`,
        gap: selected.differentiation || selected.angle,
        concept: selected.concept,
        whyDistinct: selected.differentiation || selected.angle,
        evidenceIds: [],
        confidence: 0.5,
        hypothesis: selected.validation || "Testar o conceito com variantes de hook.",
        nextTest: "Publicar variantes e comparar retenção inicial.",
      };
      const result = await generateHooks({data:{opportunity,count:8,route:"balanced",language:"pt-PT"}});
      if(!result.parsed || !Array.isArray(result.parsed.hooks)) { setMessage("O motor não devolveu hooks utilizáveis."); return; }
      const normalized = result.parsed.hooks.map((x) => ({
        id:String(x.id),
        text:String(x.text),
        mechanism:String(x.mechanism),
        promise:String(x.promise),
        payoff:String(x.payoff),
        evidenceIds:x.evidenceIds,
        originalityNotes:x.originalityNotes,
        confidence:x.confidence,
        testVariantGroup:String(x.testVariantGroup),
      }));
      setHooks(normalized);
      localStorage.setItem(HOOKS_KEY, JSON.stringify(normalized));
    } catch(e) {
      setMessage(e instanceof Error?e.message:"Não foi possível gerar os hooks.");
    } finally { setLoading(false); }
  }

  function saveHook(hook: Hook) {
    const next=[...savedHooks.filter(item=>item.id!==hook.id),hook];
    setSavedHooks(next);
    localStorage.setItem(HOOKS_KEY,JSON.stringify(next));
    localStorage.setItem(SELECTED_HOOK_KEY,JSON.stringify({hook,idea:selected}));
    setMessage("Hook guardado e pronto para o Script Studio.");
  }

  function useHook(hook: Hook) {
    localStorage.setItem(SELECTED_HOOK_KEY,JSON.stringify({hook,idea:selected}));
    window.location.href="/scripts";
  }

  return <main className="min-h-screen bg-background text-foreground"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="border-b border-border pb-6">
      <Link to="/ideas" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/> Idea Engine</Link>
      <div className="mt-4 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><Target className="size-5"/></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ViralFlow · Hook Lab</p><h1 className="text-2xl font-black sm:text-3xl">Hook Workspace</h1></div></div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Transforma uma ideia em múltiplas aberturas testáveis. Cada hook mantém mecanismo, promessa, payoff e confiança separados para facilitar experiências A/B.</p>
    </header>
    <section className="mt-6 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
      <div className="rounded-3xl border border-border bg-card p-5">
        <p className="text-xs font-black uppercase tracking-wider text-primary">1 · Escolher ideia</p>
        {savedIdeas.length ? <div className="mt-4 space-y-2">{savedIdeas.map(idea=><button key={idea.concept} onClick={()=>{setSelected(idea);setHooks([])}} className={`w-full rounded-2xl border p-4 text-left ${selected?.concept===idea.concept?"border-primary bg-primary/5":"border-border hover:bg-muted/30"}`}><p className="text-sm font-black">{idea.concept}</p><p className="mt-1 text-xs text-muted-foreground">{idea.angle}</p></button>)}</div> : <div className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Guarda primeiro uma ideia no Idea Engine.</div>}
        {selected && <div className="mt-4 rounded-2xl bg-muted/20 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Promessa</p><p className="mt-1 text-sm font-semibold">{selected.promise}</p><button onClick={generate} disabled={loading} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">{loading?<Loader2 className="size-4 animate-spin"/>:<Sparkles className="size-4"/>}{loading?"A criar hooks...":"Gerar 8 hooks"}</button></div>}
        {message&&<div className="mt-4 flex gap-2 rounded-2xl border p-3 text-xs"><CircleAlert className="size-4 shrink-0 text-primary"/>{message}</div>}
      </div>
      <div><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Hook Workspace</p><h2 className="text-xl font-black">Aberturas testáveis</h2></div><span className="rounded-full bg-muted px-3 py-1.5 text-[10px] font-bold">{hooks.length} hooks</span></div>
      {hooks.length?<div className="grid gap-3">{hooks.map((hook,i)=><article key={hook.id} className="rounded-3xl border border-border bg-card p-5"><div className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-black text-primary">{String(i+1).padStart(2,"0")}</div><div className="min-w-0 flex-1"><p className="text-base font-black leading-6">{hook.text}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">{hook.mechanism}</span><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">Grupo {hook.testVariantGroup}</span><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">{Math.round(hook.confidence*100)}% coerência</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-background p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Promessa</p><p className="mt-1 text-xs leading-5">{hook.promise}</p></div><div className="rounded-2xl bg-background p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payoff</p><p className="mt-1 text-xs leading-5">{hook.payoff}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>saveHook(hook)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted"><Check className="size-4"/> Guardar</button><button onClick={()=>useHook(hook)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><FileText className="size-4"/> Usar no Script Studio</button><button onClick={()=>navigator.clipboard?.writeText(hook.text)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted"><Copy className="size-4"/> Copiar</button></div></div></div></article>)}</div>:<div className="grid min-h-[430px] place-items-center rounded-3xl border border-dashed p-8 text-center"><div><Flame className="mx-auto size-8 text-primary"/><h3 className="mt-4 font-black">Ainda não há hooks</h3><p className="mt-2 max-w-md text-sm text-muted-foreground">Escolhe uma ideia guardada e gera várias aberturas com mecanismos diferentes.</p></div></div>}</div>
    </section>
    {savedHooks.length>0 && <section className="mt-6 rounded-3xl border border-border bg-card p-5"><p className="text-xs font-black uppercase tracking-wider text-primary">Hooks guardados</p><div className="mt-3 flex flex-wrap gap-2">{savedHooks.map(h=><button key={h.id} onClick={()=>useHook(h)} className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:border-primary">{h.text}</button>)}</div></section>}
    <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Nota:</strong> hooks são hipóteses criativas. A confiança mede coerência com a evidência disponível, não probabilidade de viralização.</div>
  </div></main>
}

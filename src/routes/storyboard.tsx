import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, CircleAlert, Clapperboard, Loader2, Sparkles } from "lucide-react";
import { generateStoryboard } from "../lib/storyboard.functions";

export const Route = createFileRoute("/storyboard")({ component: StoryboardPage });

type SavedScript={title:string;format:string;scenes:Array<{time:string;visual:string;narration:string;on_screen_text:string;sfx:string;transition:string}>;};
type Shot={scene:string;time:string;shot_type:string;camera:string;composition:string;action:string;continuity:string;image_prompt:string;video_prompt:string;asset_type:string};

function StoryboardPage(){
 const [saved,setSaved]=useState<SavedScript[]>([]);
 const [title,setTitle]=useState("");
 const [format,setFormat]=useState("9:16 vertical");
 const [scenes,setScenes]=useState<SavedScript["scenes"]>([]);
 const [direction,setDirection]=useState("");
 const [shots,setShots]=useState<Shot[]>([]);
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{try{const raw=localStorage.getItem("viralflow.lastScript");if(raw){const s=JSON.parse(raw);setTitle(String(s.title??""));setFormat(String(s.format??"9:16 vertical"));setScenes(Array.isArray(s.scenes)?s.scenes:[])}}catch{}},[]);
 function loadDemoFromStorage(){try{const raw=localStorage.getItem("viralflow.lastScript");if(raw){const s=JSON.parse(raw);setTitle(String(s.title??""));setFormat(String(s.format??"9:16 vertical"));setScenes(Array.isArray(s.scenes)?s.scenes:[]);setMessage("")}}catch{}}
 async function generate(){
  if(!scenes.length){setMessage("Ainda não existe um roteiro local para transformar em storyboard. Guarda um roteiro no Script Engine ou usa a entrada preparada.");return}
  setLoading(true);setMessage("");setShots([]);
  try{const r=await generateStoryboard({data:{title,format,scenes,route:"balanced"}});if(!r.parsed){setMessage("O motor não devolveu um storyboard utilizável.");return}
   setDirection(String(r.parsed.visual_direction??""));
   const raw=Array.isArray(r.parsed.shots)?r.parsed.shots:[];
   setShots(raw.filter((x):x is Record<string,unknown>=>!!x&&typeof x==="object").map(x=>({scene:String(x.scene??"—"),time:String(x.time??"—"),shot_type:String(x.shot_type??"—"),camera:String(x.camera??"—"),composition:String(x.composition??"—"),action:String(x.action??"—"),continuity:String(x.continuity??"—"),image_prompt:String(x.image_prompt??"—"),video_prompt:String(x.video_prompt??"—"),asset_type:String(x.asset_type??"mixed")})));
  }catch(e){setMessage(e instanceof Error?e.message:"Não foi possível gerar o storyboard.");}finally{setLoading(false)}
 }
 return <main className="min-h-screen bg-background text-foreground"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
  <header className="border-b border-border pb-6"><Link to="/scripts" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/> Script Studio</Link><div className="mt-4 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><Clapperboard className="size-5"/></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ViralFlow · Production</p><h1 className="text-2xl font-black sm:text-3xl">Storyboard Engine</h1></div></div><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Converte cada cena do roteiro em planos visuais coerentes, prontos para alimentar imagem, vídeo e edição.</p></header>
  <section className="mt-6 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
   <div className="rounded-3xl border border-border bg-card p-5"><p className="text-xs font-black uppercase tracking-wider text-primary">Entrada do roteiro</p><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Título do roteiro" className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-sm"/><input value={format} onChange={e=>setFormat(e.target.value)} placeholder="Formato, ex.: 9:16 vertical" className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm"/>
    <div className="mt-4 rounded-2xl bg-muted/20 p-4"><p className="text-xs font-bold">Cenas disponíveis</p><p className="mt-1 text-2xl font-black">{scenes.length}</p><p className="text-xs text-muted-foreground">cenas do último roteiro guardado</p></div>
    <button onClick={loadDemoFromStorage} className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-xs font-bold">Recarregar último roteiro</button>
    <button onClick={generate} disabled={loading} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">{loading?<Loader2 className="size-4 animate-spin"/>:<Sparkles className="size-4"/>}{loading?"A construir storyboard...":"Gerar storyboard"}</button>
    {message&&<div className="mt-4 flex gap-2 rounded-2xl border p-3 text-xs"><CircleAlert className="size-4 shrink-0 text-primary"/>{message}</div>}
   </div>
   <div>{shots.length?<div className="space-y-4"><div className="rounded-3xl border border-primary/20 bg-primary/5 p-5"><p className="text-xs font-bold uppercase tracking-wider text-primary">Direção visual</p><p className="mt-2 text-sm leading-6">{direction}</p></div>{shots.map((s,i)=><article key={i} className="rounded-3xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-black uppercase tracking-wider text-primary">Plano {String(i+1).padStart(2,"0")} · Cena {s.scene}</span><h2 className="mt-1 text-lg font-black">{s.shot_type}</h2></div><span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold">{s.asset_type}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Tempo" value={s.time}/><Info label="Câmara" value={s.camera}/><Info label="Composição" value={s.composition}/><Info label="Ação" value={s.action}/><Info label="Continuidade" value={s.continuity}/></div><div className="mt-4 rounded-2xl bg-muted/20 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-primary">Prompt de imagem</p><p className="mt-2 text-xs leading-5">{s.image_prompt}</p></div><div className="mt-3 rounded-2xl bg-muted/20 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-primary">Prompt de vídeo</p><p className="mt-2 text-xs leading-5">{s.video_prompt}</p></div></article>)}</div>:<div className="grid min-h-[560px] place-items-center rounded-3xl border border-dashed p-8 text-center"><div><Camera className="mx-auto size-8 text-primary"/><h2 className="mt-4 font-black">Storyboard Workspace</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">O roteiro é a fonte de verdade. Cada cena será transformada em planos com prompts específicos para imagem e vídeo.</p></div></div>}</div>
  </section>
  <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Próximo nível:</strong> estes prompts serão posteriormente ligados aos providers de imagem/vídeo e ao Media Intelligence Engine.</div>
 </div></main>
}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-background p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xs leading-5">{value}</p></div>}

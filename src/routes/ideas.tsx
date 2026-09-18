import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  CircleAlert,
  Lightbulb,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";

import { generateContentIdeas } from "../lib/ideas.functions";

export const Route = createFileRoute("/ideas")({
  component: IdeasPage,
});

type Idea = {
  concept: string;
  angle: string;
  promise: string;
  audience: string;
  format: string;
  hook: string;
  differentiation: string;
  validation: string;
};

type SavedIdea = Idea & { savedAt: string };

function IdeasPage() {
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [gaps, setGaps] = useState("");
  const [patterns, setPatterns] = useState("");
  const [topics, setTopics] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [saved, setSaved] = useState<SavedIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("viralflow.savedIdeas");
      if (stored) setSaved(JSON.parse(stored) as SavedIdea[]);
    } catch {
      // Ignore invalid local state.
    }
  }, []);

  function saveIdea(idea: Idea) {
    const next = [
      ...saved.filter((item) => item.concept !== idea.concept),
      { ...idea, savedAt: new Date().toISOString() },
    ];
    setSaved(next);
    localStorage.setItem("viralflow.savedIdeas", JSON.stringify(next));
  }

  async function generate() {
    setMessage("");
    setIdeas([]);

    const contentGaps = gaps
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const dominantPatterns = patterns
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const recurringTopics = topics
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!niche.trim()) {
      setMessage("Indica primeiro o nicho ou tema.");
      return;
    }
    if (!contentGaps.length) {
      setMessage("Adiciona pelo menos um content gap. Podes colá-los um por linha.");
      return;
    }

    setLoading(true);
    try {
      const result = await generateContentIdeas({
        data: {
          niche: niche.trim(),
          audience: audience.trim(),
          contentGaps,
          dominantPatterns,
          recurringTopics,
          route: "balanced",
        },
      });

      const parsed = result.parsed;
      if (!parsed || !Array.isArray(parsed.ideas)) {
        setMessage("O motor respondeu sem um conjunto de ideias utilizável.");
        return;
      }

      const normalized = parsed.ideas
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          concept: String(item.concept ?? "Sem conceito"),
          angle: String(item.angle ?? "—"),
          promise: String(item.promise ?? "—"),
          audience: String(item.audience ?? audience || "—"),
          format: String(item.format ?? "—"),
          hook: String(item.hook ?? "—"),
          differentiation: String(item.differentiation ?? "—"),
          validation: String(item.validation ?? "—"),
        }));

      setIdeas(normalized);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar as ideias.");
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
                <Lightbulb className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  ViralFlow · Ideation
                </p>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Idea Engine
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Transforma content gaps e padrões observados em conceitos originais,
              prontos para passar pelo Hook Lab.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Pipeline
            </p>
            <p className="mt-1 text-sm font-black">Gap → Idea → Hook → Script</p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Target className="size-5 text-primary" />
              <h2 className="text-lg font-black">Sinais de entrada</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Usa dados do Pattern Engine ou introduz os teus próprios sinais.
            </p>

            <div className="mt-5 space-y-4">
              <Field label="Nicho / tema" value={niche} onChange={setNiche} placeholder="Ex.: mistérios históricos" />
              <Field label="Público" value={audience} onChange={setAudience} placeholder="Ex.: pessoas curiosas, 18–34" />
              <TextField
                label="Content gaps · um por linha"
                value={gaps}
                onChange={setGaps}
                placeholder={"Ex.: poucos vídeos explicam o lado humano\nângulo pouco explorado: consequências atuais"}
              />
              <TextField
                label="Padrões dominantes · opcional"
                value={patterns}
                onChange={setPatterns}
                placeholder={"Ex.: perguntas no título\nrevelação progressiva"}
              />
              <TextField
                label="Tópicos recorrentes · opcional"
                value={topics}
                onChange={setTopics}
                placeholder={"Ex.: teorias\ncasos históricos"}
              />

              <button
                onClick={generate}
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {loading ? "A criar ideias..." : "Gerar ideias originais"}
              </button>
            </div>

            {message && (
              <div className="mt-4 flex gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{message}</span>
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-black">Princípio do Idea Engine</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                A referência serve para descobrir sinais. A ideia deve ser uma
                interpretação original desses sinais, não uma cópia.
              </p>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Idea Workspace
                </p>
                <h2 className="mt-1 text-xl font-black">Conceitos gerados</h2>
              </div>
              <span className="rounded-full bg-muted px-3 py-1.5 text-[10px] font-bold">
                {ideas.length} ideias
              </span>
            </div>

            {ideas.length ? (
              <div className="space-y-4">
                {ideas.map((idea, index) => (
                  <IdeaCard
                    key={idea.concept + index}
                    idea={idea}
                    index={index}
                    saved={saved.some((item) => item.concept === idea.concept)}
                    onSave={() => saveIdea(idea)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-border bg-muted/15 p-8 text-center">
                <div>
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-card">
                    <Lightbulb className="size-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-base font-black">Ainda não há conceitos</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Introduz um content gap e deixa o Idea Engine construir ângulos,
                    promessas e hooks que possam ser testados.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Bookmark className="size-5 text-primary" />
            <h2 className="text-lg font-black">Ideias guardadas</h2>
            <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">
              {saved.length}
            </span>
          </div>
          {saved.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {saved.map((idea) => (
                <div key={idea.concept} className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs font-black">{idea.concept}</p>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                    {idea.hook}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Guarda uma ideia para a manter disponível neste navegador.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function IdeaCard({
  idea,
  index,
  saved,
  onSave,
}: {
  idea: Idea;
  index: number;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="border-b border-border p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-black text-primary">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {idea.format}
            </p>
            <h3 className="mt-1 text-base font-black">{idea.concept}</h3>
          </div>
          <button
            onClick={onSave}
            className="rounded-xl border border-border p-2 text-muted-foreground hover:text-foreground"
            aria-label={saved ? "Ideia guardada" : "Guardar ideia"}
            title={saved ? "Ideia guardada" : "Guardar ideia"}
          >
            {saved ? <Check className="size-4 text-primary" /> : <Bookmark className="size-4" />}
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <DataBlock label="Ângulo" value={idea.angle} />
        <DataBlock label="Promessa" value={idea.promise} />
        <DataBlock label="Hook inicial" value={idea.hook} />
        <DataBlock label="Público" value={idea.audience} />
        <DataBlock label="Diferenciação" value={idea.differentiation} />
        <DataBlock label="Validação" value={idea.validation} />
      </div>

      <div className="flex items-center justify-between border-t border-border bg-muted/15 px-5 py-3">
        <span className="text-[10px] font-semibold text-muted-foreground">
          Próximo: Hook Lab
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
          Preparado <ChevronRight className="size-3" />
        </span>
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function DataBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs leading-5">{value}</p>
    </div>
  );
}

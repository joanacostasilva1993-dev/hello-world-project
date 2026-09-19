import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleAlert, FileText, Loader2, Play, Wand2 } from "lucide-react";
import { generateScript } from "../lib/scripts.functions";

export const Route = createFileRoute("/scripts")({ component: ScriptsPage });

type SavedIdea = {
  concept: string;
  angle: string;
  promise: string;
  audience: string;
  format: string;
  hook: string;
  differentiation: string;
  validation: string;
  savedAt: string;
};

type Scene = {
  time: string;
  visual: string;
  narration: string;
  on_screen_text: string;
  sfx: string;
  transition: string;
};

type LearningContext = {
  strongestPatterns: string[];
  weakPatterns: string[];
  experimentsToRun: string[];
};

function ScriptsPage() {
  const [ideas, setIdeas] = useState<SavedIdea[]>([]);
  const [selected, setSelected] = useState<SavedIdea | null>(null);
  const [hook, setHook] = useState("");
  const [duration, setDuration] = useState(60);
  const [script, setScript] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [learningContext, setLearningContext] = useState<LearningContext>({
    strongestPatterns: [],
    weakPatterns: [],
    experimentsToRun: [],
  });

  useEffect(() => {
    try {
      const savedIdeas = localStorage.getItem("viralflow.savedIdeas");
      if (savedIdeas) {
        const parsed = JSON.parse(savedIdeas);
        if (Array.isArray(parsed)) setIdeas(parsed);
      }

      const savedReport = localStorage.getItem("viralflow.learningReport");
      if (savedReport) {
        const report = JSON.parse(savedReport) as Partial<LearningContext>;
        setLearningContext({
          strongestPatterns: Array.isArray(report.strongestPatterns)
            ? report.strongestPatterns
            : [],
          weakPatterns: Array.isArray(report.weakPatterns) ? report.weakPatterns : [],
          experimentsToRun: Array.isArray(report.experimentsToRun)
            ? report.experimentsToRun
            : [],
        });
      }
    } catch {
      setMessage("Não foi possível carregar os dados guardados localmente.");
    }
  }, []);

  async function createScript() {
    if (!selected || !hook.trim()) {
      setMessage("Escolhe uma ideia e indica o hook que será usado.");
      return;
    }

    setLoading(true);
    setMessage("");
    setScript(null);

    try {
      const result = await generateScript({
        data: {
          concept: selected.concept,
          angle: selected.angle,
          promise: selected.promise,
          audience: selected.audience,
          format: selected.format,
          hook: hook.trim(),
          durationSeconds: duration,
          learningContext,
          route: "balanced",
        },
      });

      if (!result.parsed) {
        setMessage("O motor não devolveu um roteiro utilizável.");
        return;
      }

      setScript(result.parsed);
      localStorage.setItem(
        "viralflow.lastScript",
        JSON.stringify({ ...result.parsed, format: selected.format }),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível criar o roteiro.",
      );
    } finally {
      setLoading(false);
    }
  }

  const scenes: Scene[] =
    script && Array.isArray(script.scenes)
      ? script.scenes
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          )
          .map((item) => ({
            time: String(item.time ?? "—"),
            visual: String(item.visual ?? "—"),
            narration: String(item.narration ?? "—"),
            on_screen_text: String(item.on_screen_text ?? "—"),
            sfx: String(item.sfx ?? "—"),
            transition: String(item.transition ?? "—"),
          }))
      : [];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-border pb-6">
          <Link
            to="/hooks"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Hook Lab
          </Link>

          <div className="mt-4 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                ViralFlow · Script Studio
              </p>
              <h1 className="text-2xl font-black sm:text-3xl">Script Engine</h1>
            </div>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Transforma uma ideia e um hook num roteiro audiovisual estruturado,
            incorporando sinais recentes do Learning Loop quando disponíveis.
          </p>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="rounded-3xl border border-border bg-card p-5">
            <p className="text-xs font-black uppercase tracking-wider text-primary">
              Configuração
            </p>

            {ideas.length > 0 ? (
              <div className="mt-4 space-y-2">
                {ideas.map((idea) => {
                  const isSelected = selected?.concept === idea.concept;

                  return (
                    <button
                      key={idea.concept}
                      type="button"
                      onClick={() => {
                        setSelected(idea);
                        setHook(idea.hook);
                        setScript(null);
                        setMessage("");
                      }}
                      className={
                        "w-full rounded-2xl border p-4 text-left transition-colors " +
                        (isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/30")
                      }
                    >
                      <p className="text-sm font-black">{idea.concept}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{idea.angle}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                Guarda primeiro uma ideia no Idea Engine.
              </div>
            )}

            {selected && (
              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="script-hook"
                    className="block text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Hook escolhido
                  </label>
                  <textarea
                    id="script-hook"
                    value={hook}
                    onChange={(event) => setHook(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="script-duration"
                    className="block text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Duração alvo · {duration}s
                  </label>
                  <input
                    id="script-duration"
                    type="range"
                    min="15"
                    max="180"
                    step="15"
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                    className="mt-3 w-full"
                  />
                </div>

                <button
                  type="button"
                  onClick={createScript}
                  disabled={loading}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                  {loading ? "A escrever roteiro..." : "Criar roteiro"}
                </button>
              </div>
            )}

            {message && (
              <div className="mt-4 flex gap-2 rounded-2xl border p-3 text-xs">
                <CircleAlert className="size-4 shrink-0 text-primary" />
                <span>{message}</span>
              </div>
            )}
          </div>

          <div>
            {script ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    Roteiro gerado
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {String(script.title ?? "Sem título")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {String(script.logline ?? "")}
                  </p>
                  <div className="mt-3 inline-flex rounded-full bg-background px-3 py-1.5 text-[10px] font-bold">
                    {String(script.estimated_duration_seconds ?? duration)}s estimados
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-border bg-card">
                  <div className="grid grid-cols-[70px_1fr] border-b border-border bg-muted/20 px-4 py-3 text-[10px] font-black uppercase tracking-wider sm:grid-cols-[90px_1fr_1fr]">
                    <span>Tempo</span>
                    <span>Visual / Áudio</span>
                    <span className="hidden sm:block">Texto / SFX</span>
                  </div>

                  {scenes.map((scene, index) => (
                    <article
                      key={scene.time + "-" + index}
                      className="grid gap-3 border-b border-border p-4 last:border-0 sm:grid-cols-[90px_1fr_1fr]"
                    >
                      <div className="text-xs font-black text-primary">{scene.time}</div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Visual
                        </p>
                        <p className="mt-1 text-sm leading-5">{scene.visual}</p>

                        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Narração
                        </p>
                        <p className="mt-1 text-sm leading-6">{scene.narration}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Texto de ecrã
                        </p>
                        <p className="mt-1 text-sm">{scene.on_screen_text}</p>

                        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          SFX
                        </p>
                        <p className="mt-1 text-sm">{scene.sfx}</p>

                        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Transição
                        </p>
                        <p className="mt-1 text-sm">{scene.transition}</p>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs font-black">Final</p>
                    <p className="mt-2 text-sm leading-6">
                      {String(script.ending ?? "—")}
                    </p>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <p className="text-xs font-black">Pontos a verificar</p>
                    <div className="mt-2 space-y-2">
                      {Array.isArray(script.verification_notes) ? (
                        script.verification_notes.map((note, index) => (
                          <p
                            key={index}
                            className="text-xs leading-5 text-muted-foreground"
                          >
                            • {String(note)}
                          </p>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Nenhuma nota de verificação.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[560px] place-items-center rounded-3xl border border-dashed p-8 text-center">
                <div>
                  <Play className="mx-auto size-8 text-primary" />
                  <h2 className="mt-4 font-black">Script Workspace</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Escolhe uma ideia guardada, confirma o hook e cria o primeiro roteiro.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground">
          <strong className="text-foreground">Arquitetura:</strong> Idea → Hook → Script.
          O roteiro é produzido como dados estruturados para as próximas fases de storyboard,
          media e áudio.
        </div>
      </div>
    </main>
  );
}

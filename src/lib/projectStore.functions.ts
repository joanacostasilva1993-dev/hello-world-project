import { createEvent, type ViralFlowEvent } from "./core.functions";

const EVENT_LOG_KEY = "viralflow.eventLog";
const MAX_EVENTS = 500;

export type StageKey = "idea" | "hook" | "script" | "storyboard" | "timeline" | "published";

export const STAGE_ORDER: Array<{
  stage: StageKey;
  eventType: ViralFlowEvent["type"];
  label: string;
}> = [
  { stage: "idea", eventType: "IDEA_CREATED", label: "Ideas" },
  { stage: "hook", eventType: "HOOK_READY", label: "Hooks" },
  { stage: "script", eventType: "SCRIPT_READY", label: "Scripts" },
  { stage: "storyboard", eventType: "STORYBOARD_READY", label: "Storyboard" },
  { stage: "timeline", eventType: "TIMELINE_READY", label: "Production" },
  { stage: "published", eventType: "PUBLISHED", label: "Published" },
];

function readEvents(): ViralFlowEvent[] {
  try {
    const raw = localStorage.getItem(EVENT_LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ViralFlowEvent[]) : [];
  } catch {
    return [];
  }
}

function writeEvents(events: ViralFlowEvent[]) {
  localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
}

export function recordEvent(
  type: ViralFlowEvent["type"],
  projectId: string,
  source: string,
  payload: Record<string, unknown> = {},
): ViralFlowEvent {
  const event = createEvent(type, projectId, source, payload);
  persistEvent(event);
  return event;
}

export function persistEvent(event: ViralFlowEvent): void {
  const events = readEvents();
  events.push(event);
  writeEvents(events);
}

export function getAllEvents(): ViralFlowEvent[] {
  return readEvents();
}

export function getEventsForProject(projectId: string): ViralFlowEvent[] {
  return readEvents().filter((event) => event.projectId === projectId);
}

export function furthestStage(projectId: string): StageKey | null {
  const types = new Set(getEventsForProject(projectId).map((event) => event.type));
  let result: StageKey | null = null;
  for (const step of STAGE_ORDER) {
    if (types.has(step.eventType)) result = step.stage;
  }
  return result;
}

export type PipelineSummary = {
  perStage: Record<StageKey, number>;
  reachedAtLeast: Record<StageKey, number>;
  furthestOverall: StageKey | null;
  totalIdeas: number;
};

export function getPipelineSummary(): PipelineSummary {
  const projectIds = new Set(readEvents().map((event) => event.projectId));
  const perStage: Record<StageKey, number> = {
    idea: 0, hook: 0, script: 0, storyboard: 0, timeline: 0, published: 0,
  };
  const reachedAtLeast: Record<StageKey, number> = {
    idea: 0, hook: 0, script: 0, storyboard: 0, timeline: 0, published: 0,
  };

  let furthestOverall: StageKey | null = null;
  let furthestIndex = -1;

  for (const projectId of projectIds) {
    const stage = furthestStage(projectId);
    if (!stage) continue;
    perStage[stage] += 1;
    const index = STAGE_ORDER.findIndex((step) => step.stage === stage);
    for (let i = 0; i <= index; i += 1) {
      const step = STAGE_ORDER[i];
      if (step) reachedAtLeast[step.stage] += 1;
    }
    if (index > furthestIndex) {
      furthestIndex = index;
      furthestOverall = stage;
    }
  }

  return { perStage, reachedAtLeast, furthestOverall, totalIdeas: projectIds.size };
}

const KNOWN_KEYS = [
  "viralflow.savedIdeas",
  "viralflow.savedHooks",
  "viralflow.lastScript",
  "viralflow.storyboard",
  "viralflow.storyboardAssets",
  "viralflow.generationQueue",
  "viralflow.productionTimeline",
  "viralflow.learningReport",
  "viralflow.performanceData",
  EVENT_LOG_KEY,
];

export type ProjectSnapshot = {
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
};

export function exportSnapshot(): ProjectSnapshot {
  const data: Record<string, unknown> = {};
  for (const key of KNOWN_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      // Skip malformed optional local state.
    }
  }
  return { version: 1, exportedAt: new Date().toISOString(), data };
}

export function importSnapshot(snapshot: unknown): { imported: string[]; skipped: string[] } {
  const imported: string[] = [];
  const skipped: string[] = [];
  if (!snapshot || typeof snapshot !== "object" || !("data" in snapshot)) {
    throw new Error("Ficheiro de importação inválido: falta o campo 'data'.");
  }

  const data = (snapshot as { data: unknown }).data;
  if (!data || typeof data !== "object") {
    throw new Error("Ficheiro de importação inválido: 'data' não é um objecto.");
  }

  for (const key of KNOWN_KEYS) {
    const value = (data as Record<string, unknown>)[key];
    if (value === undefined) {
      skipped.push(key);
      continue;
    }
    localStorage.setItem(key, JSON.stringify(value));
    imported.push(key);
  }
  return { imported, skipped };
}

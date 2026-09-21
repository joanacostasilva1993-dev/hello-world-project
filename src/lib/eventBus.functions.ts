import { viralFlowEventSchema, type ViralFlowEvent } from "./core.functions";

export type ViralFlowEventListener = (event: ViralFlowEvent) => void;

export type ViralFlowEventFilter = {
  type?: ViralFlowEvent["type"];
  projectId?: string;
  source?: string;
};

export type ViralFlowEventBus = {
  publish: (event: ViralFlowEvent) => ViralFlowEvent;
  subscribe: (
    listener: ViralFlowEventListener,
    filter?: ViralFlowEventFilter,
  ) => () => void;
  history: (filter?: ViralFlowEventFilter) => ViralFlowEvent[];
  clear: () => void;
};

function matchesFilter(
  event: ViralFlowEvent,
  filter?: ViralFlowEventFilter,
): boolean {
  if (!filter) return true;
  if (filter.type && event.type !== filter.type) return false;
  if (filter.projectId && event.projectId !== filter.projectId) return false;
  if (filter.source && event.source !== filter.source) return false;
  return true;
}

export function createEventBus(maxHistory = 500): ViralFlowEventBus {
  const listeners = new Map<ViralFlowEventListener, ViralFlowEventFilter | undefined>();
  const events: ViralFlowEvent[] = [];

  return {
    publish(eventInput) {
      const event = viralFlowEventSchema.parse(eventInput);
      events.push(event);
      if (events.length > maxHistory) {
        events.splice(0, events.length - maxHistory);
      }

      for (const [listener, filter] of listeners) {
        if (matchesFilter(event, filter)) listener(event);
      }

      return event;
    },

    subscribe(listener, filter) {
      listeners.set(listener, filter);
      return () => listeners.delete(listener);
    },

    history(filter) {
      return events.filter((event) => matchesFilter(event, filter));
    },

    clear() {
      events.length = 0;
    },
  };
}

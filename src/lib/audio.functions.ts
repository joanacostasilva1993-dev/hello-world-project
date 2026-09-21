import { z } from "zod";

export const audioWordSchema = z.object({
  text: z.string().min(1).max(300),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
});

export const audioSegmentSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(2000),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
});

export const audioCaptionSchema = z.object({
  id: z.string().min(1).max(100),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().min(1).max(200),
});

export const audioTimelineSchema = z.object({
  version: z.literal(1),
  durationSeconds: z.number().positive(),
  language: z.string().min(2).max(20),
  words: z.array(audioWordSchema),
  segments: z.array(audioSegmentSchema),
  captions: z.array(audioCaptionSchema),
  confidence: z.number().min(0).max(1),
  provider: z.string().min(1).max(100),
  model: z.string().max(200),
  warnings: z.array(z.string().max(500)).max(20),
});

export type AudioTimeline = z.infer<typeof audioTimelineSchema>;
export type AudioWord = z.infer<typeof audioWordSchema>;
export type AudioSegment = z.infer<typeof audioSegmentSchema>;
export type AudioCaption = z.infer<typeof audioCaptionSchema>;

export type CaptionOptions = {
  maxCharsPerLine?: number;
  maxLines?: number;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  maxWordsPerCaption?: number;
};

function cleanWord(text: string) {
  return text.replace(/\\s+/g, " ").trim();
}

function formatSrtTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const milliseconds = Math.round(safe * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const ms = milliseconds % 1000;

  return [hours, minutes, secs]
    .map((value) => String(value).padStart(2, "0"))
    .join(":") + "," + String(ms).padStart(3, "0");
}

export function validateAudioWords(words: AudioWord[], durationSeconds: number) {
  let previousEnd = 0;

  for (const word of words) {
    if (word.startSeconds < previousEnd) {
      throw new Error("Audio timeline inválida: timestamps de palavras sobrepostos.");
    }
    if (word.endSeconds <= word.startSeconds) {
      throw new Error("Audio timeline inválida: uma palavra termina antes/depois do início.");
    }
    if (word.endSeconds > durationSeconds + 0.05) {
      throw new Error("Audio timeline inválida: timestamp ultrapassa a duração do áudio.");
    }
    previousEnd = word.endSeconds;
  }

  return words;
}

export function buildCaptionsFromWords(
  wordsInput: AudioWord[],
  options: CaptionOptions = {},
): AudioCaption[] {
  const maxCharsPerLine = options.maxCharsPerLine ?? 42;
  const maxLines = options.maxLines ?? 2;
  const minDurationSeconds = options.minDurationSeconds ?? 0.7;
  const maxDurationSeconds = options.maxDurationSeconds ?? 4.2;
  const maxWordsPerCaption = options.maxWordsPerCaption ?? 12;
  const maxChars = maxCharsPerLine * maxLines;

  if (maxCharsPerLine < 10 || maxLines < 1 || maxWordsPerCaption < 1) {
    throw new Error("Opções de legendas inválidas.");
  }

  const words = wordsInput.map((word) => ({
    ...word,
    text: cleanWord(word.text),
  })).filter((word) => word.text.length > 0);

  validateAudioWords(words, Number.POSITIVE_INFINITY);

  const captions: AudioCaption[] = [];
  let current: AudioWord[] = [];

  const flush = (nextStart?: number) => {
    if (!current.length) return;

    const startSeconds = current[0].startSeconds;
    let endSeconds = current[current.length - 1].endSeconds;
    const text = current.map((word) => word.text).join(" ");

    if (endSeconds - startSeconds < minDurationSeconds) {
      endSeconds = Math.min(
        nextStart ?? endSeconds + minDurationSeconds,
        startSeconds + maxDurationSeconds,
      );
    }

    captions.push({
      id: `caption-${captions.length + 1}`,
      startSeconds,
      endSeconds: Math.max(startSeconds + 0.05, endSeconds),
      text,
    });

    current = [];
  };

  for (const word of words) {
    const candidate = [...current, word];
    const candidateText = candidate.map((item) => item.text).join(" ");
    const hasPunctuationBreak = /[.!?…]$/.test(current[current.length - 1]?.text ?? "");
    const exceeds =
      candidateText.length > maxChars ||
      candidate.length > maxWordsPerCaption ||
      (current.length > 0 &&
        word.startSeconds - current[0].startSeconds >= maxDurationSeconds);

    if (current.length > 0 && (exceeds || hasPunctuationBreak)) {
      flush(word.startSeconds);
    }

    current.push(word);
  }

  flush();

  return captions;
}

export function captionsToSrt(captionsInput: AudioCaption[]) {
  const captions = captionsInput.map((caption, index) =>
    audioCaptionSchema.parse({ ...caption, id: caption.id || `caption-${index + 1}` }),
  );

  return captions
    .map(
      (caption, index) =>
        `${index + 1}\n${formatSrtTime(caption.startSeconds)} --> ${formatSrtTime(caption.endSeconds)}\n${caption.text}\n`,
    )
    .join("\n");
}

export function buildAudioTimeline(input: {
  durationSeconds: number;
  language: string;
  words: AudioWord[];
  segments?: AudioSegment[];
  provider?: string;
  model?: string;
  confidence?: number;
  warnings?: string[];
}): AudioTimeline {
  const durationSeconds = Number(input.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Duração do áudio inválida.");
  }

  const words = audioWordSchema.array().parse(input.words);
  validateAudioWords(words, durationSeconds);

  const segments = input.segments
    ? audioSegmentSchema.array().parse(input.segments)
    : [];

  const captions = buildCaptionsFromWords(words);

  return audioTimelineSchema.parse({
    version: 1,
    durationSeconds,
    language: input.language,
    words,
    segments,
    captions,
    confidence: input.confidence ?? 0,
    provider: input.provider ?? "unknown",
    model: input.model ?? "",
    warnings: input.warnings ?? [],
  });
}

import { describe, expect, it } from "vitest";

import {
  buildAudioTimeline,
  captionsToSrt,
  buildCaptionsFromWords,
  validateAudioWords,
} from "./audio.functions";

describe("Audio Intelligence", () => {
  const words = [
    { text: "Isto", startSeconds: 0, endSeconds: 0.4 },
    { text: "é", startSeconds: 0.45, endSeconds: 0.7 },
    { text: "um", startSeconds: 0.75, endSeconds: 1 },
    { text: "teste.", startSeconds: 1.05, endSeconds: 1.5 },
    { text: "Agora", startSeconds: 1.6, endSeconds: 2 },
    { text: "continua.", startSeconds: 2.05, endSeconds: 2.6 },
  ];

  it("validates word timestamps against audio duration", () => {
    expect(() => validateAudioWords(words, 2.5)).toThrow("ultrapassa");
    expect(validateAudioWords(words, 3)).toHaveLength(6);
  });

  it("groups words into deterministic captions", () => {
    const captions = buildCaptionsFromWords(words, {
      maxCharsPerLine: 42,
      maxLines: 2,
      maxWordsPerCaption: 12,
    });

    expect(captions).toHaveLength(2);
    expect(captions[0].text).toBe("Isto é um teste.");
    expect(captions[1].text).toBe("Agora continua.");
    expect(captions[0].startSeconds).toBe(0);
  });

  it("generates valid SRT timestamps", () => {
    const captions = buildCaptionsFromWords(words);
    const srt = captionsToSrt(captions);

    expect(srt).toContain("00:00:00,000 --> 00:00:01,500");
    expect(srt).toContain("Isto é um teste.");
    expect(srt).toContain("Agora continua.");
  });

  it("builds an audio timeline whose captions come from word timestamps", () => {
    const timeline = buildAudioTimeline({
      durationSeconds: 3,
      language: "pt-PT",
      words,
      provider: "external-audio",
      model: "transcription-pending",
    });

    expect(timeline.version).toBe(1);
    expect(timeline.durationSeconds).toBe(3);
    expect(timeline.captions.map((caption) => caption.text)).toEqual([
      "Isto é um teste.",
      "Agora continua.",
    ]);
    expect(timeline.provider).toBe("external-audio");
  });

  it("rejects overlapping words", () => {
    expect(() =>
      validateAudioWords(
        [
          { text: "um", startSeconds: 0, endSeconds: 1 },
          { text: "dois", startSeconds: 0.5, endSeconds: 1.2 },
        ],
        2,
      ),
    ).toThrow("sobrepostos");
  });
});

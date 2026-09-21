import { describe, expect, it } from "vitest";

import { parseYouTubeUrl } from "./youtube.functions";

describe("parseYouTubeUrl", () => {
  it("parses standard watch URLs", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=abc123xyz")).toEqual({ kind: "video", videoId: "abc123xyz" });
  });

  it("parses short URLs", () => {
    expect(parseYouTubeUrl("https://youtu.be/abc123xyz")).toEqual({ kind: "video", videoId: "abc123xyz" });
  });

  it("parses shorts URLs", () => {
    expect(parseYouTubeUrl("https://youtube.com/shorts/abc123xyz")).toEqual({ kind: "video", videoId: "abc123xyz" });
  });

  it("parses channel handles", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/@example")).toEqual({ kind: "channelHandle", handle: "@example" });
  });

  it("parses channel ids", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/channel/UC1234567890")).toEqual({ kind: "channelId", channelId: "UC1234567890" });
  });

  it("rejects non-YouTube URLs", () => {
    expect(() => parseYouTubeUrl("https://example.com/video")).toThrow("não pertence ao YouTube");
  });
});

import { describe, expect, it } from "vitest";
import { createDjAudio } from "./elevenlabs";

describe("ElevenLabs AI DJ audio", () => {
  it("creates a non-empty MP3 broadcast from a short Korean script", async () => {
    const audio = await createDjAudio({
      mode: "다정한 밤참",
      script: {
        title: "오늘의 작은 방송",
        opening: "오늘도 여기까지 온 당신을 환영합니다.",
        body: "잠시 숨을 고르고 편하게 머물러도 괜찮아요.",
        closing: "좋은 밤 보내세요.",
      },
    });

    expect(audio.byteLength).toBeGreaterThan(1_000);
    expect(audio.subarray(0, 3).toString("utf8")).toBe("ID3");
  }, 60_000);
});

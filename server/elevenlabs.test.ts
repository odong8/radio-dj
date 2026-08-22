import { describe, expect, it } from "vitest";
import { buildDjSpeechText, voiceProfileByMode } from "./elevenlabs";

describe("ElevenLabs DJ speech preparation", () => {
  it("joins the complete broadcast script with natural paragraph pauses", () => {
    const text = buildDjSpeechText({
      title: "《침대 행성의 신호》",
      opening: "여기는 오늘 밤의 관제센터입니다.",
      body: "이불 중력권이 강한 날도 있습니다.",
      closing: "오늘도 무사 귀환을 기원합니다.",
    });

    expect(text).toContain("침대 행성의 신호");
    expect(text).toContain("\n\n이불 중력권");
    expect(text).not.toContain("Speak Korean");
  });

  it("assigns four distinct natural voice profiles to the DJ modes", () => {
    const voices = Object.values(voiceProfileByMode);
    expect(new Set(voices.map(voice => voice.voiceId)).size).toBe(4);
    expect(voices.map(voice => voice.voiceName)).toEqual(["Lily", "Liam", "River", "Chris"]);
    expect(new Set(voices.map(voice => voice.gender))).toEqual(new Set(["female", "neutral", "male"]));
  });

});

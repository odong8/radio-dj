import { ENV } from "./_core/env";
import type { RadioScript, RadioSynthesisInput } from "./radio";

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

export const voiceProfileByMode: Record<RadioSynthesisInput["mode"], { voiceId: string; voiceName: string; gender: "female" | "neutral" | "male"; ageTone: string; stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean }> = {
  "다정한 밤참": { voiceId: "pFZP5JQG7iQjIQuC4Bku", voiceName: "Lily", gender: "female", ageTone: "30대 · 낮고 벨벳 같은 음색", stability: 0.56, similarity_boost: 0.78, style: 0.14, use_speaker_boost: true },
  "과몰입 새벽": { voiceId: "TX3LPaxmHKxFdv7VOQHJ", voiceName: "Liam", gender: "male", ageTone: "20대 · 밝고 에너지 있는 남성 음색", stability: 0.38, similarity_boost: 0.78, style: 0.44, use_speaker_boost: true },
  "엉뚱한 우주": { voiceId: "SAz9YHcvj6GT2YYXdXww", voiceName: "River", gender: "neutral", ageTone: "30대 · 중저음의 중성적 톤", stability: 0.46, similarity_boost: 0.8, style: 0.32, use_speaker_boost: true },
  "차분한 응원": { voiceId: "iP95p4xoKVk53GoZ742B", voiceName: "Chris", gender: "male", ageTone: "30대 · 부드럽고 안정적인 중저음", stability: 0.62, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true },
};

export function buildDjSpeechText(script: RadioScript) {
  return `${script.title}. ${script.opening}\n\n${script.body}\n\n${script.closing}`;
}

export async function createDjAudio(input: RadioSynthesisInput) {
  if (!ENV.elevenlabsApiKey) throw new Error("ElevenLabs API key is not configured.");
  const voice = voiceProfileByMode[input.mode];
  const response = await fetch(`${ELEVENLABS_TTS_URL}/${voice.voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": ENV.elevenlabsApiKey },
    body: JSON.stringify({ text: buildDjSpeechText(input.script), model_id: "eleven_multilingual_v2", voice_settings: { stability: voice.stability, similarity_boost: voice.similarity_boost, style: voice.style, use_speaker_boost: voice.use_speaker_boost } }),
  });
  if (!response.ok) {
    console.error("[ElevenLabs] TTS request failed", response.status);
    throw new Error(`ElevenLabs TTS request failed with status ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

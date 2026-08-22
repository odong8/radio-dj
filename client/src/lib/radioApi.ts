export const moodValues = ["잔잔해요", "답답해요", "들떠요", "피곤해요", "멍해요"] as const;
export const djModeValues = ["다정한 밤참", "과몰입 새벽", "엉뚱한 우주", "차분한 응원"] as const;

export type Mood = (typeof moodValues)[number];
export type DjMode = (typeof djModeValues)[number];

export type RadioScript = {
  title: string;
  opening: string;
  body: string;
  closing: string;
};

export type RadioGenerationInput = {
  mood: Mood;
  energy: number;
  mode: DjMode;
  story: string;
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
}

export async function generateRadioScript(input: RadioGenerationInput): Promise<RadioScript> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "방송 대사를 만들지 못했습니다. 잠시 후 다시 시도해 주세요."));
  }

  if (!payload || typeof payload !== "object" || !("title" in payload) || !("opening" in payload) || !("body" in payload) || !("closing" in payload)) {
    throw new Error("방송 대사 응답 형식을 확인하지 못했습니다.");
  }

  const script = payload as RadioScript;
  if (![script.title, script.opening, script.body, script.closing].every(value => typeof value === "string" && value.trim().length > 0)) {
    throw new Error("방송 대사 응답이 불완전합니다.");
  }

  return script;
}

export async function synthesizeRadioAudio(input: { mode: DjMode; script: RadioScript }): Promise<string> {
  const response = await fetch("/api/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new Error(getErrorMessage(payload, "AI DJ 목소리를 만들지 못했습니다."));
  }

  const audio = await response.blob();
  if (audio.size === 0) throw new Error("AI DJ 음성 데이터가 비어 있습니다.");
  return URL.createObjectURL(audio);
}

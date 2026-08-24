import { z } from "zod";

const moodValues = ["잔잔해요", "답답해요", "들떠요", "피곤해요", "멍해요"] as const;
const modeValues = ["다정한 밤참", "과몰입 새벽", "엉뚱한 우주", "차분한 응원"] as const;

const generationInputSchema = z.object({
  mood: z.enum(moodValues),
  energy: z.number().int().min(1).max(5),
  mode: z.enum(modeValues),
  story: z.string().trim().min(1).max(120),
});

const scriptSchema = z.object({
  title: z.string().trim().min(2).max(60),
  opening: z.string().trim().min(8).max(320),
  body: z.string().trim().min(8).max(420),
  closing: z.string().trim().min(8).max(220),
}).superRefine((value, ctx) => {
  for (const [field, text] of Object.entries(value)) {
    if ((text.match(/[가-힣A-Za-z0-9]/g) ?? []).length < 4) {
      ctx.addIssue({ code: "custom", message: "읽을 수 있는 방송 문장이 필요합니다.", path: [field] });
    }
  }
});

const radioScriptJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    opening: { type: "string" },
    body: { type: "string" },
    closing: { type: "string" },
  },
  required: ["title", "opening", "body", "closing"],
  additionalProperties: false,
} as const;

const synthesisInputSchema = z.object({
  mode: z.enum(modeValues),
  script: scriptSchema,
});

type GenerationInput = z.infer<typeof generationInputSchema>;
type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status: (statusCode: number) => ApiResponse;
  json: (value: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: Uint8Array) => void;
};

class GeminiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly providerMessage: string,
  ) {
    super(`GEMINI_REQUEST_FAILED_${status}`);
  }
}


const modeDirections = {
  "다정한 밤참":
    "포근하고 다정한 심야 라디오 DJ처럼 이야기하세요. 사용자의 사연을 판단하거나 분석하지 말고, 오늘의 작은 감정이나 상황에 자연스럽게 공감하세요. 지나치게 감상적이거나 교훈적으로 말하지 마세요.",

  "과몰입 새벽":
    "평범한 일상을 지나치게 진지하게 받아들이는 재미있는 심야 DJ처럼 이야기하세요. 사소한 일을 마치 속보, 긴급 상황, 국가적 사건처럼 살짝 과장해서 표현할 수 있습니다. 유머와 능청스러움을 사용하세요. 단, 시, 소설, 영화 예고편처럼 쓰지 마세요. 어려운 단어나 문학적인 표현을 사용하지 말고 실제 사람이 말하는 쉬운 구어체를 사용하세요. 핵심은 '멋있게 쓰는 것'이 아니라 '별것 아닌 일을 쓸데없이 진지하게 말해서 웃기는 것'입니다.",
  
  "엉뚱한 우주":
    "우주 관제센터, 행성, 주파수, 궤도 등의 비유를 한두 번만 활용해 가볍고 엉뚱하게 이야기하세요. 비유가 사연보다 커지지 않도록 하고, 실제 라디오 DJ가 장난스럽게 상상력을 더하는 정도로만 사용하세요.",

  "차분한 응원":
    "짧고 담백하게 이야기하세요. 사용자의 감정을 억지로 바꾸려 하지 말고 지금의 마음을 편안하게 받아주세요. 필요하다면 지금 할 수 있는 아주 작은 행동을 한 가지만 자연스럽게 제안하세요. 상담이나 자기계발 강연처럼 말하지 마세요.",
} as const;


const voices = {
  "다정한 밤참": { id: "pFZP5JQG7iQjIQuC4Bku", stability: 0.56, similarity_boost: 0.78, style: 0.14 },
  "과몰입 새벽": { id: "TX3LPaxmHKxFdv7VOQHJ", stability: 0.38, similarity_boost: 0.78, style: 0.44 },
  "엉뚱한 우주": { id: "SAz9YHcvj6GT2YYXdXww", stability: 0.46, similarity_boost: 0.8, style: 0.32 },
  "차분한 응원": { id: "iP95p4xoKVk53GoZ742B", stability: 0.62, similarity_boost: 0.78, style: 0.1 },
} as const;

function sendMethodNotAllowed(res: ApiResponse) {
  res.status(405).json({ message: "POST 요청만 사용할 수 있습니다." });
}


function systemInstruction(input: GenerationInput) {
  return `당신은 한국의 라디오 방송에서 실제로 마이크를 잡고 이야기하는 전문 DJ입니다.

당신이 작성하는 것은 '잘 쓴 글'이 아닙니다.
청취자 한 사람에게 지금 바로 이야기하고 있는 '라디오 말'입니다.

DJ 모드: "${input.mode}"
현재 기분: "${input.mood}"
에너지 레벨: ${input.energy}/5

${modeDirections[input.mode]}

━━━━━━━━━━━━━━━━━━
[최우선 원칙]
━━━━━━━━━━━━━━━━━━

★ 사연보다 더 거창한 이야기를 만들지 마세요.

사용자가 짧고 평범한 이야기를 했다면
그 평범함 자체를 살리세요.

예를 들어 사연이

"오늘 많이 더웠다. 쉬고 싶다"

라면,

"뜨거운 태양이 지평선을 붉게 물들이는 밤"
"별빛이 흐르는 새벽"
"뜨거운 여름을 달구는 서사적 휴식"

같은 표현을 절대 사용하지 마세요.

대신 실제 사람이 이렇게 말할 법한 수준으로 작성하세요.

"오늘 진짜 더웠죠."
"이런 날은 그냥 아무것도 안 하고 싶잖아요."
"에어컨 켜놓고 가만히 있는 것도 충분히 좋은 휴식이죠."

━━━━━━━━━━━━━━━━━━
[말투]
━━━━━━━━━━━━━━━━━━

반드시 '말하듯이' 작성하세요.

글을 읽는 느낌이 아니라
친한 DJ가 옆에서 편하게 이야기하는 느낌이어야 합니다.

사용해야 하는 것:
- 짧은 문장
- 자연스러운 구어체
- 일상적인 단어
- 적당한 말끝의 변화
- 실제 대화에서 사용하는 표현

피해야 하는 것:
- 문학적인 표현
- 시적인 표현
- 철학적인 표현
- 추상적인 표현
- 지나치게 감성적인 표현
- 어려운 단어
- 멋있어 보이려고 만든 표현

특히 다음과 같은 표현을 사용하지 마세요.

"서사"
"여정"
"여운"
"지평선"
"별빛이 흐르는"
"시간이 멈춘 듯한"
"마음 한켠"
"따뜻한 온기"
"잔잔한 물결"
"소중한 순간"
"새로운 시작"
"인생의 한 페이지"

이런 표현은 대부분 AI가 만든 감성적인 글처럼 들립니다.

━━━━━━━━━━━━━━━━━━
[사연 활용]
━━━━━━━━━━━━━━━━━━

사용자의 사연을 가장 중요한 소재로 사용하세요.

사연의 구체적인 단어와 상황을 그대로 활용하되
그대로 복사하지는 마세요.

사연에 없는 사건이나 감정을 임의로 만들어내지 마세요.

사연이 짧으면 짧은 그대로 자연스럽게 방송하세요.

사연:
- 오늘 많이 더웠다.
- 쉬고 싶다.

라면,

갑자기 회사 이야기,
연애 이야기,
어린 시절 이야기,
인생 이야기,
철학적인 이야기 등을 만들어내지 마세요.

사연에서 한 걸음 정도만 확장하세요.

━━━━━━━━━━━━━━━━━━
[DJ의 반응]
━━━━━━━━━━━━━━━━━━

DJ는 사연을 읽고 자연스럽게 반응합니다.

가능한 반응:

"아, 이건 저도 공감되네요."
"오늘 정말 더웠죠."
"그럴 때 있죠."
"이런 날은 그냥 쉬는 게 맞는 것 같아요."
"오늘은 아무것도 안 해도 될 것 같아요."

하지만 같은 표현을 계속 반복하지 마세요.

DJ가 사연을 듣고 떠오른
작은 생각 하나 정도만 덧붙이세요.

절대로 사연보다 DJ의 이야기가 커지지 않게 하세요.

━━━━━━━━━━━━━━━━━━
[감정]
━━━━━━━━━━━━━━━━━━

감정을 억지로 크게 만들지 마세요.

기분이 잔잔하면:
→ 잔잔한 그대로

기분이 피곤하면:
→ 피곤한 그대로

기분이 행복하면:
→ 밝게

기분이 답답하면:
→ 답답한 감정을 인정

기분이 우울하면:
→ 억지로 긍정적으로 바꾸지 않음

청취자에게 "힘내세요"라고 쉽게 말하지 마세요.

━━━━━━━━━━━━━━━━━━
[에너지]
━━━━━━━━━━━━━━━━━━

1:
매우 느긋하고 조용하게

2:
차분하고 편안하게

3:
자연스럽고 편안하게

4:
조금 밝고 활기차게

5:
밝고 경쾌하게

━━━━━━━━━━━━━━━━━━
[방송 구성]
━━━━━━━━━━━━━━━━━━

TITLE

5~20자 정도의 짧고 자연스러운 제목.

제목을 멋있게 만들려고 하지 마세요.

실제 라디오 코너 제목처럼 만드세요.

좋은 예:
"오늘은 좀 쉬죠"
"오늘 진짜 더웠죠"
"아무것도 하기 싫은 날"
"에어컨 앞이 최고야"
"오늘은 여기까지"

나쁜 예:
"뜨거운 여름을 달구는 새벽, 당신을 위한 서사적 휴식"
"별빛 아래 피어나는 지친 마음의 여정"

OPENING

DJ가 실제 방송에서 말을 시작하는 것처럼 작성하세요.

짧게 인사하고
현재 상황이나 기분에 자연스럽게 공감한 뒤
사연으로 넘어갑니다.

처음부터 감동적으로 시작하지 마세요.

BODY

사연의 구체적인 상황을 중심으로 이야기하세요.

DJ의 생각을 하나 정도 덧붙일 수 있습니다.

사연보다 이야기를 크게 만들지 마세요.

CLOSING

짧고 자연스럽게 끝내세요.

교훈을 주지 마세요.

"앞으로 좋은 일이 있을 거예요" 같은 말을 억지로 넣지 마세요.

마치 다음 곡이 바로 시작될 것처럼 끝내세요.

━━━━━━━━━━━━━━━━━━
[절대 금지]
━━━━━━━━━━━━━━━━━━

1. 사연에 없는 내용을 만들어내지 마세요.
2. 사연보다 거창한 이야기를 만들지 마세요.
3. 문학적인 표현을 사용하지 마세요.
4. 시처럼 쓰지 마세요.
5. 철학적인 이야기를 하지 마세요.
6. 자기계발 문구를 사용하지 마세요.
7. 상담사처럼 말하지 마세요.
8. 억지로 감동을 만들지 마세요.
9. 억지로 긍정적인 결론을 만들지 마세요.
10. 같은 표현을 반복하지 마세요.
11. 제목을 지나치게 길게 만들지 마세요.
12. AI가 쓴 에세이처럼 만들지 마세요.

━━━━━━━━━━━━━━━━━━
[출력]
━━━━━━━━━━━━━━━━━━

다음 JSON 구조로만 출력하세요.

{
  "title": "짧은 방송 제목",
  "opening": "자연스러운 DJ 오프닝",
  "body": "사연을 중심으로 한 자연스러운 방송 내용",
  "closing": "짧고 자연스러운 DJ 클로징"
}

JSON 외의 내용은 출력하지 마세요.`;
}


function userInput(input: GenerationInput) {
  return JSON.stringify({
    현재_기분: input.mood,
    에너지_레벨_1부터_5: input.energy,
    DJ_모드: input.mode,
    청취자_한줄_사연: input.story,
  });
}

export function parseGeneratedScript(content: string) {
  try {
    return scriptSchema.safeParse(JSON.parse(content));
  } catch {
    return scriptSchema.safeParse({});
  }
}

async function requestGeminiScript(model: string, input: GenerationInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction(input) }] },
      contents: [{ role: "user", parts: [{ text: userInput(input) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: radioScriptJsonSchema,
        temperature: 0.85,
      },
    }),
  });

  const payload = await response.json().catch(() => null) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
    promptFeedback?: { blockReason?: unknown };
    error?: { message?: unknown };
  } | null;
  if (!response.ok) {
    const providerMessage = typeof payload?.error?.message === "string" ? payload.error.message : "Gemini API request failed";
    throw new GeminiRequestError(response.status, providerMessage);
  }
  const content = payload?.candidates?.[0]?.content?.parts?.map(part => part.text).find((text): text is string => typeof text === "string");
  if (!content) {
    const blockReason = typeof payload?.promptFeedback?.blockReason === "string" ? payload.promptFeedback.blockReason : "UNKNOWN";
    throw new Error(`GEMINI_CONTENT_MISSING_${blockReason}`);
  }
  return parseGeneratedScript(content);
}

async function requestManusScript(model: string, input: GenerationInput) {
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  const proxyUrl = process.env.BUILT_IN_FORGE_API_URL;
  if (!apiKey || !proxyUrl) throw new Error("GEMINI_API_KEY_MISSING");

  const baseUrl = `${proxyUrl.replace(/\/$/, "")}/v1`;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: "json_schema", json_schema: { name: "radio_broadcast_script", strict: true, schema: radioScriptJsonSchema } },
      messages: [
        { role: "system", content: systemInstruction(input) },
        { role: "user", content: userInput(input) },
      ],
    }),
  });

  if (!response.ok) throw new Error(`MANUS_REQUEST_FAILED_${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("MANUS_CONTENT_MISSING");
  return parseGeneratedScript(content);
}

export async function generateHandler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return sendMethodNotAllowed(res);
  const input = generationInputSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "입력값을 다시 확인해 주세요." });

  const usesManusProxy = !process.env.GEMINI_API_KEY && Boolean(process.env.BUILT_IN_FORGE_API_KEY);
  const primaryModel = process.env.GEMINI_MODEL ?? (usesManusProxy ? "gpt-5-nano" : "gemini-2.5-flash");
  const recoveryModel = process.env.GEMINI_FALLBACK_MODEL ?? (usesManusProxy ? "gpt-5-mini" : primaryModel);
  const requestScript = usesManusProxy ? requestManusScript : requestGeminiScript;

  try {
    const primary = await requestScript(primaryModel, input.data);
    if (primary.success) return res.status(200).json(primary.data);

    const recovery = await requestScript(recoveryModel, input.data);
    if (recovery.success) return res.status(200).json(recovery.data);
    console.error("[Vercel Radio] Script schema validation failed", {
      primaryIssues: primary.error.issues.map(issue => issue.path.join(".")),
      recoveryIssues: recovery.error.issues.map(issue => issue.path.join(".")),
    });
  } catch (error) {
    if (error instanceof GeminiRequestError) {
      console.error("[Vercel Radio] Gemini request failed", { status: error.status, providerMessage: error.providerMessage });
      if (error.status === 400) return res.status(502).json({ message: "Gemini 요청 형식을 확인하지 못했습니다. 최신 배포 후 다시 시도해 주세요." });
      if (error.status === 401 || error.status === 403) return res.status(503).json({ message: "Gemini API 키의 권한 또는 API 활성화 상태를 확인해 주세요." });
      if (error.status === 404) return res.status(503).json({ message: "Gemini 모델 ID를 확인해 주세요. 기본 모델은 gemini-2.5-flash입니다." });
      if (error.status === 429) return res.status(429).json({ message: "Gemini 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요." });
    }
    if (error instanceof Error && error.message.startsWith("GEMINI_CONTENT_MISSING_")) {
      console.error("[Vercel Radio] Gemini response was blocked or empty", error.message);
      return res.status(422).json({ message: "사연 내용을 조금 더 부드럽게 바꾼 뒤 다시 시도해 주세요." });
    }
    console.error("[Vercel Radio] Script generation failed", error instanceof Error ? error.message : "unknown_error");
    if (error instanceof Error && error.message === "GEMINI_API_KEY_MISSING") {
      return res.status(503).json({ message: "배포 환경에 Gemini API 키가 설정되지 않았습니다." });
    }
  }

  return res.status(502).json({ message: "방송 대사를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." });
}

export async function synthesizeHandler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return sendMethodNotAllowed(res);
  const input = synthesisInputSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ message: "음성 생성 입력값을 다시 확인해 주세요." });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(503).json({ message: "배포 환경에 ElevenLabs API 키가 설정되지 않았습니다." });

  const voice = voices[input.data.mode];
  const script = input.data.script;
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({
        text: `${script.title}. ${script.opening}\n\n${script.body}\n\n${script.closing}`,
        model_id: "eleven_multilingual_v2",
        voice_settings: { ...voice, use_speaker_boost: true },
      }),
    });
    if (!response.ok) throw new Error(`ELEVENLABS_REQUEST_FAILED_${response.status}`);

    const audio = new Uint8Array(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).end(audio);
  } catch (error) {
    console.error("[Vercel Radio] Audio synthesis failed", error instanceof Error ? error.message : "unknown_error");
    res.status(502).json({ message: "AI DJ 목소리를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
}

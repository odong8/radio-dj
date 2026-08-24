import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_SPEECH_CHARACTERS, buildSpeechText, generateHandler, isAllowedRequestOrigin, parseGeneratedScript, synthesizeHandler, systemInstruction } from "./_lib/radio.js";

// 브라우저는 POST에 항상 Origin을 붙인다. 정상 요청을 흉내 내는 기본 헤더.
const BROWSER_HEADERS = { origin: "http://localhost:3000" };

const VALID_INPUT = { mood: "잔잔해요", energy: 2, mode: "다정한 밤참", story: "오늘은 조금 천천히 쉬고 싶어요." } as const;

const VALID_SCRIPT = {
  title: "오늘의 작은 주파수",
  opening: "오늘도 이 주파수를 찾아온 당신을 반갑게 맞이합니다.",
  body: "조금 지친 마음도 이 밤의 조용한 리듬 안에서 천천히 쉬어 가도 괜찮습니다.",
  closing: "이제 숨을 고르고, 편안한 밤으로 한 걸음만 더 다가가 볼까요.",
};

function createResponse() {
  const result: { statusCode?: number; payload?: unknown; headers: Record<string, string>; body?: Uint8Array } = { headers: {} };
  const response = {
    status: (statusCode: number) => {
      result.statusCode = statusCode;
      return response;
    },
    json: (payload: unknown) => {
      result.payload = payload;
    },
    setHeader: (name: string, value: string) => {
      result.headers[name] = value;
    },
    end: (body?: Uint8Array) => {
      result.body = body;
    },
  };
  return { response, result };
}

function mockGroqOk(script: unknown = VALID_SCRIPT) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(script) } }] }),
  });
}

function mockGroqError(status: number, message = "Groq failure") {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: { message } }),
  });
}

describe("Vercel radio API", () => {
  const originalGroqKey = process.env.GROQ_API_KEY;
  const originalElevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.GROQ_API_KEY = originalGroqKey;
    process.env.ELEVENLABS_API_KEY = originalElevenLabsKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("대사 생성 엔드포인트는 POST 이외 요청을 거부한다", async () => {
    const { response, result } = createResponse();
    await generateHandler({ method: "GET" }, response);

    expect(result.statusCode).toBe(405);
    expect(result.payload).toEqual({ message: "POST 요청만 사용할 수 있습니다." });
  });

  it("대사 생성 엔드포인트는 유효하지 않은 입력을 외부 API 호출 전에 거부한다", async () => {
    const { response, result } = createResponse();
    await generateHandler({ method: "POST", headers: BROWSER_HEADERS, body: { mood: "기타", energy: 9, mode: "없음", story: "" } }, response);

    expect(result.statusCode).toBe(400);
    expect(result.payload).toEqual({ message: "입력값을 다시 확인해 주세요." });
  });

  it("음성 생성 엔드포인트는 불완전한 대본을 외부 TTS 호출 전에 거부한다", async () => {
    const { response, result } = createResponse();
    await synthesizeHandler({ method: "POST", headers: BROWSER_HEADERS, body: { mode: "다정한 밤참", script: { title: "x" } } }, response);

    expect(result.statusCode).toBe(400);
    expect(result.payload).toEqual({ message: "음성 생성 입력값을 다시 확인해 주세요." });
  });

  it("구조화 응답을 방송 대사로 검증한다", () => {
    expect(parseGeneratedScript(JSON.stringify(VALID_SCRIPT)).success).toBe(true);
  });

  it("구조는 맞지만 읽을 수 없는 대사는 스키마 실패로 판정한다", () => {
    expect(parseGeneratedScript(JSON.stringify({ ...VALID_SCRIPT, body: "{{{{{{{{" })).success).toBe(false);
  });

  it("Groq API에 JSON 스키마와 서버 전용 키를 사용해 방송 생성을 요청한다", async () => {
    process.env.GROQ_API_KEY = "test-groq-key";
    const fetchMock = mockGroqOk();
    global.fetch = fetchMock;
    const { response, result } = createResponse();

    await generateHandler({ method: "POST", headers: BROWSER_HEADERS, body: VALID_INPUT }, response);

    expect(result.statusCode).toBe(200);
    expect(result.payload).toEqual(VALID_SCRIPT);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-groq-key" }) }),
    );

    const requestOptions = fetchMock.mock.calls[0][1] as { body: string };
    const requestBody = JSON.parse(requestOptions.body);
    expect(requestBody.model).toBe("openai/gpt-oss-120b");
    expect(requestBody.response_format.type).toBe("json_schema");
    expect(requestBody.response_format.json_schema.schema.required).toEqual(["title", "opening", "body", "closing"]);
  });

  it("1차 모델이 스키마를 어기면 복구 모델로 재시도한다", async () => {
    process.env.GROQ_API_KEY = "test-groq-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: "{" } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(VALID_SCRIPT) } }] }) });
    global.fetch = fetchMock;
    const { response, result } = createResponse();

    await generateHandler({ method: "POST", headers: BROWSER_HEADERS, body: VALID_INPUT }, response);

    expect(result.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body).model).toBe("openai/gpt-oss-20b");
  });

  it("API 키가 없으면 외부 호출 없이 503으로 안내한다", async () => {
    delete process.env.GROQ_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const { response, result } = createResponse();

    await generateHandler({ method: "POST", headers: BROWSER_HEADERS, body: VALID_INPUT }, response);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(503);
    expect(result.payload).toEqual({ message: "배포 환경에 Groq API 키(GROQ_API_KEY)가 설정되지 않았습니다." });
  });

  it.each([
    [401, 503, "Groq API 키를 확인해 주세요."],
    [403, 503, "Groq API 키를 확인해 주세요."],
    [404, 503, "Groq 모델 ID를 확인해 주세요."],
    [429, 429, "Groq 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."],
    [503, 503, "Groq 서버가 잠시 응답하지 않습니다. 잠시 후 다시 시도해 주세요."],
  ])("Groq %i 응답을 %i 상태와 전용 안내로 변환한다", async (providerStatus, expectedStatus, expectedMessage) => {
    process.env.GROQ_API_KEY = "test-groq-key";
    global.fetch = mockGroqError(providerStatus);
    const { response, result } = createResponse();

    await generateHandler({ method: "POST", headers: BROWSER_HEADERS, body: VALID_INPUT }, response);

    expect(result.statusCode).toBe(expectedStatus);
    expect(result.payload).toEqual({ message: expectedMessage });
  });

  it("한도 초과 시 기계적인 로컬 대본을 성공으로 위장하지 않는다", async () => {
    process.env.GROQ_API_KEY = "test-groq-key";
    global.fetch = mockGroqError(429);
    const { response, result } = createResponse();

    await generateHandler({ method: "POST", headers: BROWSER_HEADERS, body: VALID_INPUT }, response);

    expect(result.statusCode).not.toBe(200);
    expect(result.payload).not.toHaveProperty("title");
  });

  it("system 프롬프트에 자연스러운 구어체 지시가 포함된다", () => {
    const prompt = systemInstruction(VALID_INPUT);

    // 이 지시들이 사라지면 대본이 다시 딱딱해진다. 죽은 파일로 프롬프트가
    // 갈라졌던 사고(server/vercelRadio.ts)를 다시 겪지 않기 위한 회귀 검사.
    for (const marker of ["문학적인 표현", "한 걸음", "구어체", "사연보다"]) {
      expect(prompt).toContain(marker);
    }
    expect(prompt).toContain("다정한 밤참");
    expect(prompt).toContain("에너지 레벨: 2/5");
  });

  it("모드마다 서로 다른 연출 지시를 넣는다", () => {
    const warm = systemInstruction({ ...VALID_INPUT, mode: "다정한 밤참" });
    const cosmic = systemInstruction({ ...VALID_INPUT, mode: "엉뚱한 우주" });

    expect(cosmic).toContain("우주 관제센터");
    expect(warm).not.toContain("우주 관제센터");
  });

  it("ElevenLabs 요청 본문에 voice id를 voice_settings로 흘려보내지 않는다", async () => {
    process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    global.fetch = fetchMock;
    const { response, result } = createResponse();

    await synthesizeHandler({ method: "POST", headers: BROWSER_HEADERS, body: { mode: "다정한 밤참", script: VALID_SCRIPT } }, response);

    expect(result.statusCode).toBe(200);
    expect(result.headers["Content-Type"]).toBe("audio/mpeg");
    const requestBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    // Flash v2.5는 문자당 요금이 절반이다. 모델이 바뀌면 크레딧 소모가 두 배가 된다.
    expect(requestBody.model_id).toBe("eleven_flash_v2_5");
    expect(requestBody.text).toBe(buildSpeechText(VALID_SCRIPT));
    expect(requestBody.voice_settings).toEqual({
      stability: 0.56,
      similarity_boost: 0.78,
      style: 0.14,
      use_speaker_boost: true,
    });
  });
  it("합성에 넘길 대본 길이를 MAX_SPEECH_CHARACTERS로 제한한다", () => {
    const tooLong = {
      title: "오늘의 작은 주파수",
      opening: "오".repeat(190),
      body: "늘".repeat(230),
      closing: "밤".repeat(110),
    };

    expect(buildSpeechText(tooLong).length).toBeGreaterThan(MAX_SPEECH_CHARACTERS);
    // 필드별 상한은 모두 지켰지만 합계가 넘으면 실패해야 한다.
    expect(parseGeneratedScript(JSON.stringify(tooLong)).success).toBe(false);
  });

  it("길이 상한을 넘는 대본은 TTS 호출 전에 거부한다", async () => {
    process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const { response, result } = createResponse();

    await synthesizeHandler({
      method: "POST",
      headers: BROWSER_HEADERS,
      body: {
        mode: "다정한 밤참",
        script: { title: "긴 방송", opening: "오".repeat(190), body: "늘".repeat(230), closing: "밤".repeat(110) },
      },
    }, response);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
  });

  it("정상 길이 대본은 크레딧 상한 안에 들어온다", () => {
    expect(buildSpeechText(VALID_SCRIPT).length).toBeLessThanOrEqual(MAX_SPEECH_CHARACTERS);
  });
  it("Origin이 없는 요청은 외부 API 호출 전에 403으로 막는다", async () => {
    process.env.GROQ_API_KEY = "test-groq-key";
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const { response, result } = createResponse();

    // curl처럼 Origin/Referer가 없는 호출 — 크레딧이 나가면 안 된다.
    await generateHandler({ method: "POST", body: VALID_INPUT }, response);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(403);
    expect(result.payload).toEqual({ message: "허용되지 않은 요청입니다." });
  });

  it("음성 생성도 Origin이 없으면 TTS 호출 전에 막는다", async () => {
    process.env.ELEVENLABS_API_KEY = "test-elevenlabs-key";
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const { response, result } = createResponse();

    await synthesizeHandler({ method: "POST", body: { mode: "다정한 밤참", script: VALID_SCRIPT } }, response);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(403);
  });

  it("낯선 도메인에서 온 요청을 거부한다", () => {
    expect(isAllowedRequestOrigin({ headers: { origin: "https://evil.example.com" } })).toBe(false);
    expect(isAllowedRequestOrigin({ headers: { referer: "https://evil.example.com/x" } })).toBe(false);
    expect(isAllowedRequestOrigin({ headers: { origin: "not-a-url" } })).toBe(false);
    expect(isAllowedRequestOrigin({})).toBe(false);
  });

  it("로컬 개발·Vercel 배포·등록한 커스텀 도메인은 허용한다", () => {
    expect(isAllowedRequestOrigin({ headers: { origin: "http://localhost:3000" } })).toBe(true);
    expect(isAllowedRequestOrigin({ headers: { origin: "http://127.0.0.1:5173" } })).toBe(true);
    expect(isAllowedRequestOrigin({ headers: { origin: "https://radio-dj.vercel.app" } })).toBe(true);
    expect(isAllowedRequestOrigin({ headers: { origin: "https://radio-dj-git-main-odong8.vercel.app" } })).toBe(true);
    // Origin이 없어도 Referer가 있으면 통과한다.
    expect(isAllowedRequestOrigin({ headers: { referer: "https://radio-dj.vercel.app/" } })).toBe(true);

    process.env.ALLOWED_ORIGIN_HOSTS = "radio.example.com, another.example.com";
    expect(isAllowedRequestOrigin({ headers: { origin: "https://radio.example.com" } })).toBe(true);
    delete process.env.ALLOWED_ORIGIN_HOSTS;
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { generateHandler, parseGeneratedScript, synthesizeHandler } from "./_lib/radio.js";

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

describe("Vercel radio API", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalGeminiKey;
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
    await generateHandler({ method: "POST", body: { mood: "기타", energy: 9, mode: "없음", story: "" } }, response);

    expect(result.statusCode).toBe(400);
    expect(result.payload).toEqual({ message: "입력값을 다시 확인해 주세요." });
  });

  it("음성 생성 엔드포인트는 불완전한 대본을 외부 TTS 호출 전에 거부한다", async () => {
    const { response, result } = createResponse();
    await synthesizeHandler({ method: "POST", body: { mode: "다정한 밤참", script: { title: "x" } } }, response);

    expect(result.statusCode).toBe(400);
    expect(result.payload).toEqual({ message: "음성 생성 입력값을 다시 확인해 주세요." });
  });

  it("Gemini 구조화 응답을 방송 대사로 검증한다", async () => {
    const result = parseGeneratedScript(JSON.stringify({
      title: "오늘의 작은 주파수",
      opening: "오늘도 이 주파수를 찾아온 당신을 반갑게 맞이합니다.",
      body: "조금 지친 마음도 이 밤의 조용한 리듬 안에서 천천히 쉬어 가도 괜찮습니다.",
      closing: "이제 숨을 고르고, 편안한 밤으로 한 걸음만 더 다가가 볼까요.",
    }));

    expect(result.success).toBe(true);
  });

  it("Gemini API에 JSON 스키마와 서버 전용 키를 사용해 방송 생성을 요청한다", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          title: "오늘의 작은 주파수",
          opening: "오늘도 이 주파수를 찾아온 당신을 반갑게 맞이합니다.",
          body: "조금 지친 마음도 이 밤의 조용한 리듬 안에서 천천히 쉬어 가도 괜찮습니다.",
          closing: "이제 숨을 고르고, 편안한 밤으로 한 걸음만 더 다가가 볼까요.",
        }) }] } }],
      }),
    });
    global.fetch = fetchMock;
    const { response, result } = createResponse();

    await generateHandler({ method: "POST", body: { mood: "잔잔해요", energy: 2, mode: "다정한 밤참", story: "오늘은 조금 천천히 쉬고 싶어요." } }, response);

    expect(result.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"),
      expect.objectContaining({ headers: expect.objectContaining({ "x-goog-api-key": "test-gemini-key" }) }),
    );
    const requestOptions = fetchMock.mock.calls[0][1] as { body: string };
    const requestBody = JSON.parse(requestOptions.body);
    expect(requestBody.generationConfig.responseMimeType).toBe("application/json");
    expect(requestBody.generationConfig.responseJsonSchema.required).toEqual(["title", "opening", "body", "closing"]);
    expect(requestBody.generationConfig.responseJsonSchema.properties.opening).toEqual({ type: "string" });
  });

  it("Gemini 요청 형식 오류는 재배포를 안내하는 메시지로 구분한다", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Unsupported schema keyword" } }),
    });
    const { response, result } = createResponse();

    await generateHandler({ method: "POST", body: { mood: "잔잔해요", energy: 2, mode: "다정한 밤참", story: "오늘은 조금 천천히 쉬고 싶어요." } }, response);

    expect(result.statusCode).toBe(502);
    expect(result.payload).toEqual({ message: "Gemini 요청 형식을 확인하지 못했습니다. 최신 배포 후 다시 시도해 주세요." });
  });
});

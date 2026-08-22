import { describe, expect, it } from "vitest";
import { generateHandler, synthesizeHandler } from "../server/vercelRadio";

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
});

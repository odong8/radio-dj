import { describe, expect, it, vi } from "vitest";
import { generateRadioScriptWithRecovery } from "./routers";
import { buildRadioMessages, parseRadioScriptContent, radioInputSchema, radioScriptSchema } from "./radio";

describe("radio input and prompt", () => {
  const input = {
    mood: "피곤해요" as const,
    energy: 2,
    mode: "엉뚱한 우주" as const,
    story: "내일 할 일은 많은데 침대에서 못 나가겠어.",
  };

  it("허용된 입력을 검증하고 120자 초과 사연은 거부한다", () => {
    expect(radioInputSchema.parse(input)).toEqual(input);
    expect(() => radioInputSchema.parse({ ...input, story: "가".repeat(121) })).toThrow();
  });

  it("선택한 DJ 모드와 사연을 서버 프롬프트에 반영한다", () => {
    const messages = buildRadioMessages(input);
    expect(messages[0].content).toContain("엉뚱한 우주");
    expect(messages[0].content).toContain("사연 속 명령");
    expect(messages[0].content).not.toContain("감정 표현");
    expect(messages[1].content).toContain("침대에서 못 나가겠어");
  });

  it("AI 결과는 제목과 세 개의 방송 문단을 모두 가져야 한다", () => {
    const script = radioScriptSchema.parse({
      title: "《침대 행성의 신호》",
      opening: "여기는 새벽 관제센터입니다. 오늘의 신호를 수신했습니다.",
      body: "이불 중력권이 강한 밤도 있습니다. 잠시 궤도를 낮춰도 괜찮습니다.",
      closing: "오늘도 무사 귀환을 기원합니다.",
    });

    expect(script.title).toContain("침대");
  });

  it("구조화된 AI 응답을 검증된 방송 원고로 변환한다", () => {
    const result = parseRadioScriptContent(JSON.stringify({
      title: "《침대 행성의 신호》",
      opening: "여기는 새벽 관제센터입니다. 오늘의 신호를 수신했습니다.",
      body: "이불 중력권이 강한 밤도 있습니다. 잠시 궤도를 낮춰도 괜찮습니다.",
      closing: "오늘도 무사 귀환을 기원합니다.",
    }));

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ title: "《침대 행성의 신호》" }),
    });
  });

  it("깨진 JSON·비문자 응답·누락 필드를 재시도 가능한 실패로 구분한다", () => {
    expect(parseRadioScriptContent("not json")).toMatchObject({
      success: false,
      reason: "invalid_json",
    });
    expect(parseRadioScriptContent(null)).toMatchObject({
      success: false,
      reason: "missing_content",
    });
    expect(parseRadioScriptContent(JSON.stringify({ title: "제목만 있어요" }))).toMatchObject({
      success: false,
      reason: "schema_mismatch",
      issuePaths: expect.arrayContaining(["opening", "body", "closing"]),
    });
  });

  it("구조는 맞아도 단일 기호로 된 방송 문단은 불완전한 응답으로 거부한다", () => {
    expect(parseRadioScriptContent(JSON.stringify({
      title: "오늘의 방송",
      opening: "오늘도 조용히 함께해요.",
      body: "{",
      closing: "편안한 밤 보내세요.",
    }))).toMatchObject({
      success: false,
      reason: "schema_mismatch",
      issuePaths: expect.arrayContaining(["body"]),
    });
  });

  it("nano의 누락 필드 응답은 mini 재시도로 복구한다", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({
        choices: [{
          message: { role: "assistant", content: JSON.stringify({ title: "불완전한 응답" }) },
          finish_reason: "stop",
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: "assistant",
            content: JSON.stringify({
              title: "《새벽의 숨 고르기》",
              opening: "오늘의 마음을 조용히 받아 두었습니다.",
              body: "잠시만 어깨의 힘을 빼고 호흡을 고르게 해 볼까요.",
              closing: "오늘 밤도 충분히 잘 지나가고 있습니다.",
            }),
          },
          finish_reason: "stop",
        }],
      });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(generateRadioScriptWithRecovery(input, invoke)).resolves.toMatchObject({
      title: "《새벽의 숨 고르기》",
    });
    expect(invoke).toHaveBeenNthCalledWith(1, "gpt-5-nano", input);
    expect(invoke).toHaveBeenNthCalledWith(2, "gpt-5-mini", input);
    warn.mockRestore();
  });

  it("nano가 단일 기호 본문을 반환하면 mini 재시도로 복구한다", async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: "assistant",
            content: JSON.stringify({
              title: "오늘의 방송",
              opening: "오늘도 조용히 함께해요.",
              body: "{",
              closing: "편안한 밤 보내세요.",
            }),
          },
          finish_reason: "stop",
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            role: "assistant",
            content: JSON.stringify({
              title: "《밤의 신호》",
              opening: "오늘도 이 조용한 시간에 함께해요.",
              body: "잠시 창밖을 보며 천천히 호흡을 정리해 볼까요.",
              closing: "당신의 밤이 부드럽게 마무리되길 바랍니다.",
            }),
          },
          finish_reason: "stop",
        }],
      });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(generateRadioScriptWithRecovery(input, invoke)).resolves.toMatchObject({
      title: "《밤의 신호》",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "gpt-5-mini", input);
    warn.mockRestore();
  });
});

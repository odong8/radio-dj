import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "audio-test-user",
      email: "audio-test@example.com",
      name: "Audio Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("radio.synthesize", () => {
  it("creates AI audio and returns a storage URL for an authenticated listener", async () => {
    const caller = appRouter.createCaller(createAuthenticatedContext());
    const result = await caller.radio.synthesize({
      mode: "차분한 응원",
      script: {
        title: "오늘의 작은 방송",
        opening: "오늘도 여기까지 온 당신을 환영합니다.",
        body: "잠시 숨을 고르고 편하게 머물러도 괜찮아요.",
        closing: "좋은 밤 보내세요.",
      },
    });

    expect(result.url).toMatch(/^\/manus-storage\//);
  }, 90_000);
});

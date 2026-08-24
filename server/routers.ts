import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

// 방송 대사·음성 생성은 Vercel 서버리스 함수와 공유하는 `api/_lib/radio.ts`가
// 담당한다. 클라이언트는 tRPC가 아니라 `/api/generate`·`/api/synthesize`를
// 직접 호출하므로 이 라우터에는 세션 관련 프로시저만 남긴다.
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;

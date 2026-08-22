import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, type InvokeResult } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createDjAudio } from "./elevenlabs";
import { buildRadioMessages, parseRadioScriptContent, radioInputSchema, radioResponseJsonSchema, radioSynthesisSchema, type RadioInput, type RadioScript, type RadioScriptParseFailure } from "./radio";
import { storagePut } from "./storage";

const PRIMARY_RADIO_MODEL = "gpt-5-nano";
const RECOVERY_RADIO_MODEL = "gpt-5-mini";
type RadioLlmInvoker = (model: string, input: RadioInput) => Promise<InvokeResult>;

class RadioResponseFormatError extends Error {
  constructor(
    readonly details: RadioScriptParseFailure & {
      model: string;
      finishReason: string | null | undefined;
      contentKind: "text" | "parts" | "missing";
      contentLength?: number;
    },
  ) {
    super("The AI response could not be parsed as a radio script.");
  }
}

function describeLlmChoice(response: InvokeResult) {
  const choice = response.choices[0];
  const content = choice?.message?.content;

  return {
    finishReason: choice?.finish_reason,
    contentKind: typeof content === "string" ? "text" as const : Array.isArray(content) ? "parts" as const : "missing" as const,
    ...(typeof content === "string" ? { contentLength: content.length } : {}),
  };
}

async function invokeRadioModel(model: string, input: RadioInput): Promise<InvokeResult> {
  return invokeLLM({
    model,
    messages: buildRadioMessages(input),
    response_format: radioResponseJsonSchema,
  });
}

async function generateRadioScript(
  model: string,
  input: RadioInput,
  invoke: RadioLlmInvoker = invokeRadioModel,
): Promise<RadioScript> {
  const response = await invoke(model, input);
  const choice = response.choices[0];
  const parsed = parseRadioScriptContent(choice?.message?.content);

  if (!parsed.success) {
    throw new RadioResponseFormatError({
      ...parsed,
      model,
      ...describeLlmChoice(response),
    });
  }

  return parsed.data;
}

export async function generateRadioScriptWithRecovery(
  input: RadioInput,
  invoke: RadioLlmInvoker = invokeRadioModel,
): Promise<RadioScript> {
  try {
    return await generateRadioScript(PRIMARY_RADIO_MODEL, input, invoke);
  } catch (error) {
    if (!(error instanceof RadioResponseFormatError)) {
      throw error;
    }

    console.warn("[Radio] Retrying malformed script response with recovery model", error.details);
    return generateRadioScript(RECOVERY_RADIO_MODEL, input, invoke);
  }
}

function describeGenerationFailure(error: unknown) {
  if (error instanceof RadioResponseFormatError) {
    return error.details;
  }

  return {
    reason: "provider_request_failed",
    message: error instanceof Error ? error.message.slice(0, 240) : "unknown_error",
  };
}

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
  radio: router({
    generate: publicProcedure.input(radioInputSchema).mutation(async ({ input }) => {
      try {
        return await generateRadioScriptWithRecovery(input);
      } catch (error) {
        console.error("[Radio] DJ script generation failed", describeGenerationFailure(error));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "방송 대사 생성 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        });
      }
    }),
    synthesize: protectedProcedure.input(radioSynthesisSchema).mutation(async ({ input, ctx }) => {
      try {
        const audio = await createDjAudio(input);
        const { url } = await storagePut(
          `radio-broadcasts/${ctx.user.id}/${crypto.randomUUID()}.mp3`,
          audio,
          "audio/mpeg",
        );
        return { url };
      } catch (error) {
        console.error("[Radio] AI DJ audio generation failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI DJ 목소리를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
        });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;

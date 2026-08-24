import { generateHandler } from "../api/_lib/radio";

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY must be set before running this script");
}

const req = { method: "POST", headers: { origin: "http://localhost:3000" }, body: { mood: "잔잔해요", energy: 3, mode: "다정한 밤참", story: "테스트 사연입니다. 잘 들려주세요." } };

function makeRes() {
  let statusCode: number | undefined;
  let headers: Record<string,string> = {};
  let payload: any;
  return {
    status(code: number) { statusCode = code; return this; },
    json(obj: unknown) { payload = obj; console.log('RESPONSE JSON', { statusCode, payload }); return this; },
    setHeader(name: string, value: string) { headers[name] = value; },
    end(body?: Uint8Array) { console.log('RESPONSE END', { statusCode, headers, bodyLength: body?.length }); }
  } as any;
}

(async () => {
  const res = makeRes();
  await generateHandler(req as any, res as any);
})();
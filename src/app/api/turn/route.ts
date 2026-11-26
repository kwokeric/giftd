import Anthropic from "@anthropic-ai/sdk";
import { TurnRequest } from "@/lib/schemas";
import { overLimit, tooMany } from "@/lib/rate-limit";
import { TurnError, runTurn } from "@/lib/turn";

// Created lazily so a missing key fails the request, not the build.
let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TurnRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  // Checked before Claude is called, so a flood of requests costs nothing.
  if (await overLimit("turn", request.headers)) return tooMany("turn");

  try {
    const result = await runTurn(parsed.data, {
      client: getClient(),
      hooks: { onWarn: (m) => console.warn(`[turn] ${m}`) },
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof TurnError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[turn] unexpected error", err);
    return Response.json({ error: "Something went wrong" }, { status: 502 });
  }
}

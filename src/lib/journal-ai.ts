import { z } from "zod";
import { boundedJson, privateReply as reply } from "./private-http";
export const journalAiInput = z
  .object({
    action: z.enum(["improve", "correct"]),
    text: z.string().min(1).max(8000),
  })
  .strict();
export type JournalAiInput = z.infer<typeof journalAiInput>;
type Dependencies = {
  origin: string | null;
  authorize: () => Promise<null | {
    encrypted: boolean;
    reserve: () => Promise<boolean>;
  }>;
  generate: (
    input: JournalAiInput,
    signal: AbortSignal,
  ) => Promise<{ text: string; finishReason: string }>;
};
export async function handleJournalEdit(request: Request, deps: Dependencies) {
  if (!deps.origin || request.headers.get("origin") !== deps.origin)
    return reply({ error: "forbidden" }, 403);
  try {
    const auth = await deps.authorize();
    if (!auth) return reply({ error: "unauthorized" }, 401);
    // Fail closed before reading any plaintext, including from an old browser tab.
    if (auth.encrypted)
      return reply({ error: "encrypted_journal_no_remote_ai" }, 409);
    let input: JournalAiInput;
    try {
      input = journalAiInput.parse(await boundedJson(request, 40000));
    } catch {
      return reply({ error: "invalid_input" }, 400);
    }
    if (!input.text.trim()) return reply({ error: "invalid_input" }, 400);
    // SQL rechecks active membership and absence of a vault immediately before use.
    if (!(await auth.reserve()))
      return reply({ error: "rate_limit_or_protected" }, 429);
    if (request.signal.aborted) return reply({ error: "cancelled" }, 408);
    const result = await deps.generate(input, request.signal);
    if (
      result.finishReason !== "stop" ||
      !result.text.trim() ||
      result.text.length > 12000
    )
      return reply({ error: "incomplete" }, 502);
    return reply({ text: result.text });
  } catch {
    // Provider errors can contain journal excerpts. Never log or return them.
    return reply({ error: "ai_unavailable" }, 503);
  }
}

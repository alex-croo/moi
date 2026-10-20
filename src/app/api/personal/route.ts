import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { loadPersonalWorkspace } from "@/lib/personal-workspace";
import { applyPrivateMutation } from "@/lib/private-mutations";
import { boundedJson, privateReply as reply } from "@/lib/private-http";
const progress = z
  .object({
    completed: z.record(z.string().max(100), z.iso.date()),
    reflections: z.record(z.string().max(100), z.string().max(20000)),
  })
  .strict();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  // Refuse protected accounts BEFORE reading a potentially plaintext request body.
  const { data: vault, error } = await auth.db
    .from("personal_vaults")
    .select("revision")
    .maybeSingle();
  if (error) return reply({ error: "unavailable" }, 503);
  if (vault) return reply({ error: "protection_enabled" }, 409);
  let input;
  try {
    input = z
      .object({
        expectedRevision: z.number().int().min(0),
        type: z.string().max(50),
        value: z.record(z.string(), z.unknown()),
      })
      .strict()
      .parse(await boundedJson(request, 200000));
  } catch {
    return reply({ error: "invalid_input" }, 400);
  }
  try {
    const current = await loadPersonalWorkspace(auth.db);
    if (
      !current.standard ||
      current.standardRevision !== input.expectedRevision
    )
      return reply({ error: "conflict" }, 409);
    const next =
      input.type === "program"
        ? { ...current.standard, program: progress.parse(input.value) }
        : applyPrivateMutation(current.standard, input.type, input.value);
    const { data: revision, error: saveError } = await auth.db.rpc(
      "save_standard_workspace",
      { expected_revision: input.expectedRevision, personal: next },
    );
    if (saveError)
      return reply(
        { error: saveError.code === "40001" ? "conflict" : "save_failed" },
        saveError.code === "40001" ? 409 : 503,
      );
    return reply({ revision, data: next });
  } catch (e) {
    if (e instanceof Error && e.message === "conflict") return reply({ error: "conflict" }, 409);
    return reply(
      { error: e instanceof z.ZodError ? "invalid_input" : "save_failed" },
      e instanceof z.ZodError ? 400 : 503,
    );
  }
}

import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { loadPersonalWorkspace } from "@/lib/personal-workspace";
import { boundedJson, privateReply as reply } from "@/lib/private-http";
const encoded = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
const sealed = z
  .object({ iv: encoded.length(16), ciphertext: encoded.min(24).max(11000000) })
  .strict();
const envelope = z
  .object({
    version: z.literal(1),
    ownerId: z.uuid(),
    revision: z.number().int().positive(),
    iterations: z.literal(600000),
    salt: encoded.length(24),
    password: sealed.nullable(),
    passkeys: z
      .array(
        z
          .object({
            id: z.string().regex(/^[A-Za-z0-9_-]{1,2048}$/),
            salt: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
            rpId: z.string().max(253),
            wrapped: sealed,
          })
          .strict(),
      )
      .min(1)
      .max(5)
      .optional(),
    recovery: sealed,
    payload: sealed,
  })
  .strict()
  .refine((e) => e.password !== null || !!e.passkeys?.length);
export async function GET() {
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  try {
    return reply(await loadPersonalWorkspace(auth.db));
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  let raw;
  try {
    raw = await boundedJson(request);
  } catch {
    return reply({ error: "invalid_input" }, 400);
  }
  const parsed = z
    .object({
      expectedRevision: z.number().int().min(0),
      expectedStandardRevision: z.number().int().min(0).optional(),
      envelope,
    })
    .strict()
    .safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.envelope.ownerId !== auth.user.id ||
    parsed.data.envelope.revision !== parsed.data.expectedRevision + 1
  )
    return reply({ error: "invalid_input" }, 400);
  if (parsed.data.expectedRevision === 0) return reply({error:"new_vaults_retired"},410);
  const activating = parsed.data.expectedStandardRevision !== undefined;
  if (activating && parsed.data.expectedRevision !== 0)
    return reply({ error: "invalid_input" }, 400);
  const { data, error } = await auth.db.rpc(
    activating ? "activate_personal_vault" : "save_personal_vault",
    activating
      ? {
          expected_standard_revision: parsed.data.expectedStandardRevision,
          sealed: parsed.data.envelope,
        }
      : {
          expected_revision: parsed.data.expectedRevision,
          sealed: parsed.data.envelope,
        },
  );
  if (error)
    return reply(
      { error: error.code === "40001" ? "conflict" : "save_failed" },
      error.code === "40001" ? 409 : 503,
    );
  return reply({ revision: data });
}

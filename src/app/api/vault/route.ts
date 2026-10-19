import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { loadWorkspace } from "@/lib/workspace";
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
    password: sealed,
    recovery: sealed,
    payload: sealed,
  })
  .strict();
export async function GET() {
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  const { data: vault, error } = await auth.db
    .from("personal_vaults")
    .select("envelope,revision")
    .maybeSingle();
  if (error) return reply({ error: "unavailable" }, 503);
  // Owner RLS prevents a migration read of another person's legacy records.
  const workspace = await loadWorkspace(auth.db);
  const recipes = workspace.recipes.map((r) => ({
    ...r,
    source: /^https:\/\/(docs|drive)\.google\.com\//.test(r.source)
      ? ""
      : r.source,
  }));
  return reply({
    envelope: vault?.envelope ?? null,
    legacy: vault ? null : { ...workspace, recipes: [], ingredients: [] },
    catalog: { recipes, ingredients: workspace.ingredients },
  });
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
    .object({ expectedRevision: z.number().int().min(0), envelope })
    .strict()
    .safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.envelope.ownerId !== auth.user.id ||
    parsed.data.envelope.revision !== parsed.data.expectedRevision + 1
  )
    return reply({ error: "invalid_input" }, 400);
  const { data, error } = await auth.db.rpc("save_personal_vault", {
    expected_revision: parsed.data.expectedRevision,
    sealed: parsed.data.envelope,
  });
  if (error)
    return reply(
      { error: error.code === "40001" ? "conflict" : "save_failed" },
      error.code === "40001" ? 409 : 503,
    );
  return reply({ revision: data });
}

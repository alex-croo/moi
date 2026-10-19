import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { mutationSchema } from "@/lib/validation";
import { loadWorkspace } from "@/lib/workspace";

const reply = (body: object, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  try {
    return reply(await loadWorkspace(auth.db));
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "json_required" }, 415);
  // Bound streamed bodies as well as requests with Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "invalid_input" }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 65536) {
      await reader.cancel();
      return reply({ error: "too_large" }, 413);
    }
    chunks.push(value);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }
  const parsed = mutationSchema.safeParse(raw);
  if (!parsed.success) return reply({ error: "invalid_input" }, 400);
  const { type, data } = parsed.data;
  const owner_id = auth.user.id;
  let error;
  if (type === "weight")
    ({ error } = await auth.db
      .from("weight_entries")
      .upsert({ ...data, owner_id }, { onConflict: "owner_id,date" }));
  if (type === "journal")
    ({ error } = await auth.db
      .from("journal_entries")
      .upsert({ ...data, owner_id }, { onConflict: "owner_id,date" }));
  if (type === "document")
    ({ error } = await auth.db
      .from("document_links")
      .insert({ ...data, owner_id }));
  if (type === "menu")
    ({ error } = await auth.db
      .from("menu_plans")
      .insert({
        owner_id,
        title: data.title,
        title_en: data.titleEn,
        start_date: data.startDate,
        days: data.days,
      }));
  if (error) return reply({ error: "save_failed" }, 503);
  return reply({ ok: true });
}

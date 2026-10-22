import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { boundedJson, privateReply as reply } from "@/lib/private-http";
import { defaultRecipeTags, mergeRecipeTags } from "@/lib/recipe-tags";
export async function GET() {
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  const { data, error } = await auth.db.from("recipe_tags").select("id,label,label_en,category").order("created_at");
  if (error) return reply({ error: "unavailable" }, 503);
  return reply({ tags: mergeRecipeTags(data || []) });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  const { data: admin } = await auth.db.rpc("current_user_admin");
  if (admin !== true) return reply({ error: "forbidden" }, 403);
  let body; try { body = await boundedJson(request, 2048); } catch { return reply({ error: "invalid_input" }, 400); }
  const parsed = z.object({ label: z.string().trim().min(1).max(50), label_en: z.string().trim().min(1).max(50), category: z.enum(["diet", "type", "tag"]) }).strict().safeParse(body);
  if (!parsed.success) return reply({ error: "invalid_input" }, 400);
  if (defaultRecipeTags.some(tag => tag.category === parsed.data.category && tag.label.toLocaleLowerCase() === parsed.data.label.toLocaleLowerCase())) return reply({ error: "duplicate" }, 409);
  const { error } = await auth.db.from("recipe_tags").insert({ ...parsed.data, id: `tag-${crypto.randomUUID()}` });
  if (error) return reply({ error: error.code === "23505" ? "duplicate" : "save_failed" }, error.code === "23505" ? 409 : 500);
  return GET();
}

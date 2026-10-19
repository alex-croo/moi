import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { boundedJson, privateReply as reply } from "@/lib/private-http";
export async function GET() {
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  const results = await Promise.all([
    auth.db.from("circles").select("id,name,created_by"),
    auth.db.from("circle_members").select("circle_id,user_id,alias"),
    auth.db
      .from("circle_invitations")
      .select("id,circle_id,email,circle_name,inviter_alias,expires_at"),
    auth.db
      .from("circle_events")
      .select("id,circle_id,user_id,kind,created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  if (results.some((r) => r.error)) return reply({ error: "unavailable" }, 503);
  return reply({
    circles: results[0].data,
    members: results[1].data,
    invitations: results[2].data,
    events: results[3].data,
  });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  let raw;
  try {
    raw = await boundedJson(request, 4096);
  } catch {
    return reply({ error: "invalid_input" }, 400);
  }
  const parsed = z
    .object({
      action: z.enum([
        "create",
        "invite",
        "accept",
        "decline",
        "post",
        "leave",
        "alias",
        "cancel",
        "remove",
        "close",
      ]),
      cid: z.uuid().nullable().default(null),
      target: z.string().max(254).default(""),
      label: z.string().max(50).default(""),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return reply({ error: "invalid_input" }, 400);
  const { data, error } = await auth.db.rpc("circle_action", parsed.data);
  if (error) return reply({ error: "operation_failed" }, 400);
  return reply({ id: data });
}

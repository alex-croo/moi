import { z } from "zod";
import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { boundedJson, privateReply as reply } from "@/lib/private-http";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  const { data: admin } = await auth.db.rpc("current_user_admin");
  if (admin !== true) return reply({ error: "forbidden" }, 403);
  let raw;
  try {
    raw = await boundedJson(request, 4096);
  } catch {
    return reply({ error: "invalid_input" }, 400);
  }
  const parsed = z
    .object({
      action: z.enum(["list", "invite", "cancel", "suspend", "restore"]),
      target: z.string().max(254).default(""),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return reply({ error: "invalid_input" }, 400);
  const { data, error } = await auth.db.rpc("manage_platform", parsed.data);
  if (error) return reply({ error: "operation_failed" }, 400);
  return reply(data);
}

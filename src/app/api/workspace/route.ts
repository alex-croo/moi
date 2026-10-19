import { authorizedClient } from "@/lib/supabase";
import { privateReply as reply } from "@/lib/private-http";
// Old clients must never send personal content after the privacy upgrade.
export async function GET() {
  const auth = await authorizedClient();
  return reply(
    { error: auth ? "vault_required" : "unauthorized" },
    auth ? 410 : 401,
  );
}
export async function POST() {
  const auth = await authorizedClient();
  return reply(
    { error: auth ? "vault_required" : "unauthorized" },
    auth ? 410 : 401,
  );
}

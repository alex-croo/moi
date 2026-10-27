import { authorizedClient, supabaseServer } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { privateReply } from "@/lib/private-http";

export async function GET() {
  const auth = await authorizedClient();
  return auth ? privateReply({ expiresAt: auth.sessionExpiry }) : privateReply({ error: "unauthorized" }, 401);
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return privateReply({ error: "forbidden" }, 403);
  const auth = await authorizedClient(true);
  if (!auth) {
    const db = await supabaseServer();
    await db?.auth.signOut({ scope: "local" });
    return privateReply({ error: "unauthorized" }, 401);
  }
  return privateReply({ expiresAt: auth.sessionExpiry });
}

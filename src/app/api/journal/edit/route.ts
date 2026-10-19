import { authorizedClient } from "@/lib/supabase";
import { privateReply as reply } from "@/lib/private-http";
// Deliberately do not parse the request body or invoke any external model.
export async function POST() {
  const auth = await authorizedClient();
  return reply(
    { error: auth ? "encrypted_journal_no_remote_ai" : "unauthorized" },
    auth ? 409 : 401,
  );
}

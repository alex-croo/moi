import { authorizedClient } from "@/lib/supabase";
import { trustedOrigin } from "@/lib/security";
import { handleInstacart, instacartConfig } from "@/lib/instacart-server";

function handle(request: Request) {
  return handleInstacart(request, {
    origin: trustedOrigin(request),
    authorize: async () => !!await authorizedClient(),
    config: instacartConfig(), fetcher: fetch,
  });
}
export const POST = handle;
export const GET = handle;

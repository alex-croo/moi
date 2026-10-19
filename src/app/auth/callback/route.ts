import { NextResponse } from "next/server";
import { supabaseServer, authorizedClient } from "@/lib/supabase";
import { trustedOrigin } from "@/lib/security";
import { localeOf } from "@/lib/locale";
export async function GET(request: Request) {
  const origin = trustedOrigin();
  if (!origin)
    return new Response("Authentication is not configured", { status: 503 });
  const url = new URL(request.url);
  const locale = localeOf(url.searchParams.get("locale") || "fr");
  const code = url.searchParams.get("code");
  const db = await supabaseServer();
  if (code && db) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      await db.rpc("claim_platform_invitation");
      if (await authorizedClient())
        return NextResponse.redirect(`${origin}/${locale}/dashboard`);
      await db.auth.signOut();
      return NextResponse.redirect(`${origin}/${locale}?error=access`);
    }
  }
  return NextResponse.redirect(`${origin}/${locale}?error=auth`);
}

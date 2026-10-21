import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { sameOrigin, trustedOrigin } from "@/lib/security";
import { localeOf } from "@/lib/locale";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const locale = localeOf(String((await request.formData()).get("locale")));
  const db = await supabaseServer();
  if (!db)
    return new Response("Authentication is not configured", { status: 503 });
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${trustedOrigin(request)}/auth/callback?locale=${locale}`,
      scopes: "openid email profile",
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url)
    return NextResponse.redirect(
      `${trustedOrigin(request)}/${locale}?error=auth`,
      303,
    );
  return NextResponse.redirect(data.url, 303);
}

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { sameOrigin, trustedOrigin } from "@/lib/security";
import { localeOf } from "@/lib/locale";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const locale = localeOf(String((await request.formData()).get("locale")));
  const db = await supabaseServer();
  if (db) await db.auth.signOut();
  return NextResponse.redirect(`${trustedOrigin()}/${locale}`, 303);
}

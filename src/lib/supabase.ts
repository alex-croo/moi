import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "./security";

export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export async function supabaseServer() {
  if (!configured()) return null;
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server components cannot write cookies; proxy refreshes them. */
          }
        },
      },
    },
  );
}
export async function authorizedClient(touch = false) {
  const db = await supabaseServer();
  if (!db) return null;
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user || !user.email_confirmed_at) return null;
  const { data: session, error: denied } = await db.rpc("app_session_status", { touch });
  if (denied || session?.active !== true) return null;
  return { db, user, sessionExpiry: session.expiresAt as string };
}

export function trustedOrigin(): string | null {
  try {
    const url = new URL(process.env.SITE_URL || "");
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    if (
      url.protocol !== "https:" &&
      !(
        process.env.VERCEL !== "1" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function sameOrigin(request: Request) {
  const expected = trustedOrigin();
  return expected !== null && request.headers.get("origin") === expected;
}
export function demoEnabled() {
  return process.env.ENABLE_DEMO === "true" && process.env.VERCEL !== "1";
}

// Supabase is used only on the server; the browser never needs to read tokens.
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.VERCEL === "1" || trustedOrigin()?.startsWith("https://") === true,
    sameSite: "lax" as const,
    path: "/",
  };
}

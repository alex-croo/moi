function validOrigin(value: string): string | null {
  try {
    const url = new URL(value);
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

// Explicit first-party aliases keep existing sessions and domain-bound passkeys
// usable during a rename. Never trust an Origin or forwarded host by itself.
export function trustedOrigin(request?: Request): string | null {
  const primary = validOrigin(process.env.SITE_URL || "");
  if (!primary || !request) return primary;
  const allowed = [primary, ...(process.env.SITE_URL_ALIASES || "")
    .split(",").map((value) => validOrigin(value.trim())).filter(Boolean)];
  try {
    const url = new URL(request.url);
    // Next's local server can reconstruct request.url with localhost while the
    // browser used 127.0.0.1. Host is still required to match an explicit origin;
    // forwarded headers cannot add another trusted destination.
    const host = request.headers.get("host") || url.host;
    return allowed.find((origin) => {
      const candidate = new URL(origin!);
      return candidate.host === host && candidate.protocol === url.protocol;
    }) || null;
  } catch {
    return null;
  }
}
export function sameOrigin(request: Request) {
  const expected = trustedOrigin(request);
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

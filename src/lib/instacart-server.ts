import { boundedJson, privateReply as reply } from "./private-http";
import { instacartInput, instacartListBody, isInstacartLink } from "./instacart";
import { z } from "zod";

type Config = { key: string; environment: "development" | "production" };
type Dependencies = { origin: string | null; authorize: () => Promise<boolean>; config: Config | null; fetcher: typeof fetch };
export function instacartConfig(): Config | null {
  const key = process.env.INSTACART_API_KEY?.trim();
  const environment = process.env.INSTACART_ENVIRONMENT;
  if (!key || environment !== "production" && environment !== "development") return null;
  if (process.env.VERCEL_ENV === "production" && environment !== "production") return null;
  return { key, environment };
}
export async function handleInstacart(request: Request, deps: Dependencies) {
  if (request.method === "POST" && (!deps.origin || request.headers.get("origin") !== deps.origin)) return reply({ error: "forbidden" }, 403);
  try {
    if (!await deps.authorize()) return reply({ error: "unauthorized" }, 401);
    if (request.method === "GET") return reply({ configured: !!deps.config });
    if (!deps.config) return reply({ error: "instacart_not_configured" }, 503);
    let input;
    try { input = instacartInput.parse(await boundedJson(request, 200000)); }
    catch { return reply({ error: "invalid_input" }, 400); }
    const base = deps.config.environment === "production" ? "https://connect.instacart.com" : "https://connect.dev.instacart.tools";
    const retailers = input.action === "retailers";
    const url = input.action === "retailers" ? `${base}/idp/v1/retailers?${new URLSearchParams({ postal_code: input.postalCode, country_code: "CA" })}` : `${base}/idp/v1/products/products_link`;
    const response = await deps.fetcher(url, {
      method: retailers ? "GET" : "POST", cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${deps.config.key}`, Accept: "application/json", "Content-Type": "application/json", "Accept-Language": input.locale === "fr" ? "fr-CA" : "en-CA" },
      ...(!retailers && input.action === "export" ? { body: JSON.stringify(instacartListBody(input)) } : {}),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) return reply({ error: response.status === 429 ? "instacart_busy" : "instacart_unavailable" }, response.status === 429 ? 429 : 502);
    const result: unknown = await response.json();
    if (retailers) {
      const parsed = z.object({ retailers: z.array(z.object({ name: z.string().min(1).max(200), retailer_key: z.string().min(1).max(200) })).max(200) }).parse(result);
      return reply({ ...parsed, development: deps.config.environment === "development" });
    }
    const { products_link_url: link } = z.object({ products_link_url: z.string().max(4096) }).parse(result);
    if (!isInstacartLink(link, deps.config.environment === "development")) return reply({ error: "instacart_unavailable" }, 502);
    return reply({ url: link, development: deps.config.environment === "development" });
  } catch {
    // Upstream errors can include credentials or private groceries. Never log them.
    return reply({ error: "instacart_unavailable" }, 503);
  }
}

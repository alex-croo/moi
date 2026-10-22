import { authorizedClient } from "@/lib/supabase";
import { sameOrigin } from "@/lib/security";
import { boundedJson, privateReply as reply } from "@/lib/private-http";
import { fireworksText, requirePrivateFireworks } from "@/lib/fireworks";
import { prepareReceipt, receiptInput, receiptInstructions, receiptOutput } from "@/lib/receipt";
import type { Purchase } from "@/lib/shopping-types";
import type { Ingredient } from "@/lib/types";
import { z } from "zod";

export const maxDuration = 180;
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "forbidden" }, 403);
  const auth = await authorizedClient();
  if (!auth) return reply({ error: "unauthorized" }, 401);
  try {
    const { data: vault, error: vaultError } = await auth.db.from("personal_vaults").select("revision").eq("owner_id", auth.user.id).maybeSingle();
    if (vaultError) return reply({ error: "unavailable" }, 503);
    if (vault) return reply({ error: "protection_enabled" }, 409);
    const parsed = receiptInput.safeParse(await boundedJson(request, 85000));
    if (!parsed.success) return reply({ error: "invalid_input" }, 400);
    const input = parsed.data;
    // Select only the authenticated owner's orders, never their journal or other private data.
    const { data: workspace, error } = await auth.db.from("standard_workspaces").select("shopping:data->shopping").eq("owner_id", auth.user.id).maybeSingle();
    if (error) return reply({ error: "unavailable" }, 503);
    const shopping = workspace?.shopping as unknown as { orders?: Purchase[] } | undefined;
    const order = shopping?.orders?.find(o => o.id === input.orderId && o.status === "pending");
    if (!order) return reply({ error: "order_unavailable" }, 404);
    await requirePrivateFireworks(auth.user.id);
    const { data: permitted, error: quotaError } = await auth.db.rpc("reserve_ai_edit");
    if (quotaError) return reply({ error: "unavailable" }, 503);
    if (permitted !== true) return reply({ error: "rate_limit" }, 429);
    const { data: catalog, error: catalogError } = await auth.db.from("ingredients").select("id,details");
    if (catalogError) return reply({ error: "unavailable" }, 503);
    const ingredients = (catalog || []).map(i => ({ ...i.details, id: i.id })) as Ingredient[];
    const output = await fireworksText(receiptInstructions, {
      locale: input.locale, receipt: input.text,
      expected: order.lines.map((l, index) => ({ index, name: l.name || ingredients.find(i => i.id === l.ingredientId)?.name, ingredientId: l.ingredientId })),
      catalog: ingredients.map(i => ({ id: i.id, name: i.name, nameEn: i.nameEn })),
    }, true, true, auth.user.id, { maxTokens: 16000, maxCharacters: 100000, timeoutMs: 150000, reasoning: "none", schema: z.toJSONSchema(receiptOutput) });
    try { return reply(prepareReceipt(JSON.parse(output), input.text, order, ingredients, input.locale)); }
    catch (error) {
      const known = ["ungrounded_item", "duplicate_item", "unknown_ingredient", "unknown_order_line", "invalid_quantity"];
      const category = error instanceof z.ZodError ? error.issues.slice(0, 10).map(i => `${i.path.join(".")}:${i.code}`).join(",") : error instanceof Error && known.includes(error.message) ? error.message : "invalid_structure";
      console.warn("receipt_validation_failed", category);
      return reply({ error: "incomplete_receipt" }, 502);
    }
  } catch (error) {
    // Only machine categories are logged, never receipt content or provider response bodies.
    const message = error instanceof Error ? error.message : "";
    const category = error instanceof Error && error.name === "TimeoutError" ? "timeout" : /^(provider_http_\d{3}|retention_unverified|unexpected_model|incomplete_output|invalid_output)$/.test(message) ? message : "unavailable";
    console.warn("receipt_analysis_failed", category);
    return reply({ error: "ai_unavailable" }, 503);
  }
}

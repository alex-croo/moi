import "server-only";
// No fallback: another model or unverified retention must never receive journal data.
export function fireworksStatus() {
  const model = process.env.FIREWORKS_MODEL || "accounts/fireworks/models/ember-1";
  let proof: { account?: string; model?: string; validUntil?: string; reference?: string } = {};
  try { proof = JSON.parse(process.env.FIREWORKS_ZDR_VERIFICATION || "{}"); } catch { /* fail closed */ }
  const ready = !!process.env.FIREWORKS_API_KEY && model === "accounts/fireworks/models/ember-1" && proof.account === "bigbob" && proof.model === model && !!proof.reference && Date.parse(proof.validUntil || "") > Date.now();
  return { ready, model, provider: "Fireworks · Ember-1", reason: ready ? "" : "La personnalisation attend la validation de la zéro rétention. Vos notes restent dans Tred’meal." };
}
export async function requirePrivateFireworks() {
  if (!fireworksStatus().ready) throw Error("retention_unverified");
  const r = await fetch("https://api.fireworks.ai/v1/accounts/bigbob/policySettings", {
    headers: { Authorization: `Bearer ${process.env.FIREWORKS_API_KEY}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw Error("retention_unverified");
  const p = (await r.json()).zeroDataRetention;
  const enforcement = p?.inference?.enforcement;
  if (!(enforcement === "ENFORCED" || (p?.defaultEnforced === true && (!enforcement || enforcement === "INHERIT" || enforcement === "ENFORCEMENT_UNSPECIFIED")))) throw Error("retention_unverified");
}
export async function fireworksText(instructions: string, input: unknown, privateData = true, json = false) {
  if (privateData) await requirePrivateFireworks();
  if (!process.env.FIREWORKS_API_KEY) throw Error("provider_unavailable");
  const model = fireworksStatus().model;
  const r = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(50000),
    headers: { Authorization: `Bearer ${process.env.FIREWORKS_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, store: false, stream: false, max_tokens: 4000, ...(json ? {response_format:{type:"json_object"}} : {}), messages: [
      { role: "system", content: instructions }, { role: "user", content: JSON.stringify(input) },
    ] }),
  });
  if (!r.ok) throw Error("provider_unavailable");
  const result = await r.json();
  if (result.model !== model) throw Error("unexpected_model");
  if (result.choices?.[0]?.finish_reason !== "stop") throw Error("incomplete_output");
  const text = result.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim() || text.length > 25000) throw Error("invalid_output");
  return text;
}

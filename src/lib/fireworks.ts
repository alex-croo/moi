import "server-only";
// Private testing is explicitly limited to one authenticated owner. Other users still require verified retention.
export function fireworksStatus(ownerId?: string) {
  const model = process.env.FIREWORKS_MODEL || "accounts/fireworks/models/ember-1";
  let proof: { account?: string; model?: string; validUntil?: string; reference?: string } = {};
  try { proof = JSON.parse(process.env.FIREWORKS_ZDR_VERIFICATION || "{}"); } catch { /* fail closed */ }
  const pilot = !!ownerId && ownerId === process.env.FIREWORKS_PRIVATE_PILOT_OWNER;
  const verified = proof.account === "bigbob" && proof.model === model && !!proof.reference && Date.parse(proof.validUntil || "") > Date.now();
  const ready = !!process.env.FIREWORKS_API_KEY && model === "accounts/fireworks/models/ember-1" && (pilot || verified);
  return { ready, model, provider: "Fireworks · Ember-1", reason: ready ? "" : "L’assistance IA n’est pas disponible pour ce compte. Vous pouvez continuer à écrire.", pilot };
}
export async function requirePrivateFireworks(ownerId?: string) {
  const status = fireworksStatus(ownerId);
  if (!status.ready) throw Error("retention_unverified");
  if (status.pilot) return;
  const r = await fetch("https://api.fireworks.ai/v1/accounts/bigbob/policySettings", {
    headers: { Authorization: `Bearer ${process.env.FIREWORKS_API_KEY}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw Error("retention_unverified");
  const p = (await r.json()).zeroDataRetention;
  const enforcement = p?.inference?.enforcement;
  if (!(enforcement === "ENFORCED" || (p?.defaultEnforced === true && (!enforcement || enforcement === "INHERIT" || enforcement === "ENFORCEMENT_UNSPECIFIED")))) throw Error("retention_unverified");
}
export async function fireworksText(instructions: string, input: unknown, privateData = true, json = false, ownerId?: string, limits: { maxTokens?: number; maxCharacters?: number; timeoutMs?: number; reasoning?: "none"; schema?: Record<string, unknown> } = {}) {
  if (privateData) await requirePrivateFireworks(ownerId);
  if (!process.env.FIREWORKS_API_KEY) throw Error("provider_unavailable");
  const model = fireworksStatus().model;
  const r = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(limits.timeoutMs ?? 50000),
    headers: { Authorization: `Bearer ${process.env.FIREWORKS_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, store: false, stream: false, max_tokens: limits.maxTokens ?? 4000, ...(limits.reasoning ? { reasoning_effort: limits.reasoning } : {}), ...(limits.schema ? { response_format: { type: "json_schema", json_schema: { name: "result", schema: limits.schema } } } : json ? {response_format:{type:"json_object"}} : {}), messages: [
      { role: "system", content: instructions + (limits.schema ? `\nRequired JSON schema: ${JSON.stringify(limits.schema)}` : "") }, { role: "user", content: JSON.stringify(input) },
    ] }),
  });
  if (!r.ok) throw Error(`provider_http_${r.status}`);
  const result = await r.json();
  if (result.model !== model) throw Error("unexpected_model");
  if (result.choices?.[0]?.finish_reason !== "stop") throw Error("incomplete_output");
  const text = result.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim() || text.length > (limits.maxCharacters ?? 25000)) throw Error("invalid_output");
  return text;
}

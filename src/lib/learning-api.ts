import { z } from "zod";
import { authorizedClient } from "./supabase";
import { sameOrigin } from "./security";
import { boundedJson, privateReply } from "./private-http";
import { learningContent } from "./learning-validation";
import { fireworksStatus } from "./fireworks";
const date = z.iso.date().optional(), rev = z.number().int().nonnegative();
const base = { date };
const personal = z.discriminatedUnion("action", [
 z.object({ action: z.enum(["state","ensure","complete"]), ...base, timeZone: z.string().max(100).optional() }).strict(),
 z.object({ action: z.literal("note"), ...base, key: z.string().min(1).max(80), text: z.string().max(20000), expectedRevision: rev }).strict(),
 z.object({ action: z.enum(["quiet","skip","preferences"]), ...base, enabled: z.boolean() }).strict(),
 z.object({ action: z.literal("memory"), operation: z.enum(["forget","forget_all","confirm"]), id: z.uuid().optional(), text: z.string().min(1).max(400).optional() }).strict(),
]);
const admin = z.discriminatedUnion("action", [
 z.object({action:z.literal("admin_list")}).strict(),
 z.object({action:z.literal("admin_module"),title:z.string().min(3).max(180),objective:z.string().max(1500)}).strict(),
 z.object({action:z.literal("admin_save"),id:z.uuid().optional(),moduleId:z.uuid(),expectedRevision:rev.optional(),content:learningContent}).strict(),
 z.object({action:z.enum(["admin_review","admin_publish","admin_archive","admin_restore"]),id:z.uuid(),expectedRevision:rev,reviewed:z.boolean().optional(),version:rev.optional()}).strict(),
 z.object({action:z.literal("admin_versions"),id:z.uuid()}).strict(),
]);
export async function learningRequest(request: Request, editorial = false) {
 if (!sameOrigin(request)) return privateReply({error:"forbidden"},403);
 const auth = await authorizedClient(); if (!auth) return privateReply({error:"unauthorized"},401);
 try {
  const parsed = (editorial ? admin : personal).safeParse(await boundedJson(request,85000));
  if (!parsed.success) return privateReply({error:"invalid"},400);
  const {action,...payload} = parsed.data;
  if (action === "preferences" && "enabled" in payload && payload.enabled && !fireworksStatus(auth.user.id).ready) return privateReply({error:"unavailable"},503);
  const {data,error} = await auth.db.rpc("learning_action",{action,payload});
  if (error) return privateReply({error:error.code === "40001" ? "conflict" : "unavailable"},error.code === "42501" ? 403 : error.code === "40001" ? 409 : 400);
  return privateReply(action === "note" || action === "admin_versions" ? data : {...data,ai:fireworksStatus(auth.user.id)});
 } catch { return privateReply({error:"unavailable"},503); }
}

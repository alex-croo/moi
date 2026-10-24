import { z } from "zod";
const source = z.object({ id: z.string().max(30), title: z.string().min(1).max(500), url: z.url().refine(v => v.startsWith("https://")), note: z.string().max(1500).optional() }).strict();
export const learningContent = z.object({
  title: z.string().trim().min(3).max(180), objective: z.string().trim().min(3).max(1500),
  body: z.string().trim().min(40).max(20000), action: z.string().trim().min(3).max(2000),
  question: z.string().trim().min(3).max(1200), sources: z.array(source).min(1).max(20),
  limits: z.string().trim().min(3).max(2500), adaptations: z.string().trim().min(3).max(2500),
  reviewedOn: z.iso.date(),
}).strict();
// The editor can rewrite prose, but cannot alter approved facts, sources or review metadata.
export const editorialRewrite = learningContent.pick({ title: true, body: true, action: true, question: true });
export const companionOutput = z.object({
  introduction: z.string().trim().min(10).max(700), experiment: z.string().trim().min(10).max(700), question: z.string().trim().min(10).max(500),
  bridge: z.string().trim().min(10).max(500),
  recall: z.object({sourceDate:z.iso.date(),prompt:z.string().trim().min(10).max(400),hint:z.string().trim().min(10).max(600)}).strict().nullable(),
  memories: z.array(z.object({ text: z.string().min(5).max(400), sourceDate: z.iso.date(), category: z.enum(["motivation", "constraint", "preference", "experiment", "observation"]) }).strict()).max(3),
}).strict();

import { z } from "zod";
export const quantitySchema = z.object({
 kind: z.enum(["mass", "volume", "spoon", "count"]), value: z.number().finite().min(0).max(1000000),
 label: z.string().max(80).optional(), labelEn: z.string().max(80).optional(),
 unit: z.enum(["piece", "clove", "bulb", "can", "pack", "bunch", "slice"]).optional(),
 gramsPerItem: z.number().positive().max(1000000).optional(), weightBasis: z.enum(["measured", "package", "estimated"]).optional(),
 content: z.object({kind:z.enum(["mass","volume"]),value:z.number().positive().max(1000000),basis:z.enum(["net","drained"])}).strict().optional(),
 basis:z.enum(["net","drained"]).optional(),
}).strict();

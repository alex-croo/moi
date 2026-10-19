import { z } from "zod";
const date = z.iso.date();
const title = z.string().trim().min(1).max(160);
const meal = z.object({
  title,
  titleEn: title,
  minutes: z.number().int().min(1).max(600),
  portions: z.number().int().min(1).max(20),
  kind: z.enum(["bowl", "salmon", "pasta", "taco"]),
});
export const menuSchema = z
  .object({
    title,
    titleEn: title,
    startDate: date,
    days: z
      .array(
        z.object({ date, lunch: meal.nullable(), dinner: meal.nullable() }),
      )
      .length(6),
  })
  .superRefine((plan, ctx) => {
    plan.days.forEach((day, index) => {
      const expected = new Date(`${plan.startDate}T12:00:00Z`);
      expected.setUTCDate(expected.getUTCDate() + index);
      if (day.date !== expected.toISOString().slice(0, 10))
        ctx.addIssue({
          code: "custom",
          path: ["days", index, "date"],
          message: "Six consecutive days required, starting on startDate",
        });
    });
  });
export const documentSchema = z.object({
  title,
  kind: z.enum(["menu", "recipe", "journal", "other"]),
  url: z
    .url()
    .max(2048)
    .refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        ["drive.google.com", "docs.google.com"].includes(u.hostname) &&
        !u.username &&
        !u.password &&
        !u.port
      );
    }, "Use an HTTPS Google Drive or Google Docs link"),
});
export const mutationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("weight"),
    data: z.object({
      date,
      value: z.number().min(1).max(1500),
      unit: z.enum(["lb", "kg"]),
    }),
  }),
  z.object({
    type: z.literal("journal"),
    data: z.object({
      date,
      text: z.string().trim().min(1).max(20000),
      mood: z.number().int().min(1).max(5),
    }),
  }),
  z.object({ type: z.literal("document"), data: documentSchema }),
  z.object({ type: z.literal("menu"), data: menuSchema }),
]);

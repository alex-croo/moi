import { z } from "zod";
import { quantitySchema } from "./quantity-schema";
import { aisles } from "./grocery-aisles";
const date = z.iso.date();
const title = z.string().trim().min(1).max(160);
const ingredientId = z.string().regex(/^[a-z0-9-]{1,100}$/);
export const pantrySchema = z.object({
  id: z.uuid(),
  ingredientId: ingredientId.nullable(),
  name: title,
  location: z.enum(["cupboard", "fridge", "freezer", "spices"]),
  aisle: z.enum(aisles).optional(),
  quantity: quantitySchema.nullable(),
  note: z.string().trim().max(160),
  inStock: z.boolean(),
});
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
export const unitSchema = z.object({
  bodyMass: z.enum(["lb", "kg"]),
  ingredientMass: z.enum(["g", "kg", "oz", "lb"]),
  volume: z.enum(["ml", "l", "cup", "cup_metric", "fl_oz"]),
  spoons: z.enum(["spoon", "ml"]),
  temperature: z.enum(["C", "F"]),
  length: z.enum(["cm", "in"]),
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
      text: z.string().max(20000),
      title: z.string().max(160).default(""),
      expectedRevision: z.number().int().min(0),
      mood: z.number().int().min(1).max(5),
    }),
  }),
  z.object({ type: z.literal("preferences"), data: unitSchema }),
  z.object({
    type: z.literal("slot"),
    data: z.object({
      date,
      slot: z.enum([
        "breakfast",
        "morning_snack",
        "lunch",
        "afternoon_snack",
        "dinner",
        "evening_snack",
      ]),
      recipeId: z
        .string()
        .regex(/^[a-z0-9-]{1,100}$/)
        .nullable(),
    }),
  }),
  z.object({
    type: z.literal("groceryCheck"),
    data: z.object({
      week: date.refine((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 1),
      ingredientId,
      checked: z.boolean(),
    }),
  }),
  z.object({ type: z.literal("pantry"), data: pantrySchema }),
  z.object({
    type: z.literal("pantryDelete"),
    data: z.object({ id: z.uuid() }),
  }),
  z.object({ type: z.literal("document"), data: documentSchema }),
  z.object({ type: z.literal("menu"), data: menuSchema }),
]);

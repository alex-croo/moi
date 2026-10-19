// Produce a transaction for review; applying it is a separate authenticated administrator action.
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
const id = z.string().regex(/^[a-z0-9-]{1,100}$/);
const text = z.string().min(1).max(20000);
const number = z.number().finite().nonnegative();
const nutrition = z
  .object({
    kcal: number.max(1000),
    protein: number.max(100),
    carbs: number.max(100),
    fat: number.max(100),
  })
  .strict();
const image = z.string().regex(/^\/api\/recipe-images\/[a-z0-9-]{1,100}$/);
const source = z.url().refine((v) => new URL(v).protocol === "https:");
const schema = z
  .object({
    ingredients: z
      .array(
        z
          .object({
            id,
            name: text,
            nameEn: text,
            state: text,
            nutrition,
            source,
            sourceLabel: text,
            sourceDescription: text,
            estimated: z.boolean(),
          })
          .strict(),
      )
      .min(1),
    recipes: z
      .array(
        z
          .object({
            id,
            title: text,
            titleEn: text,
            subtitle: text,
            subtitleEn: text,
            minutes: z.number().int().positive().max(600),
            servings: z.number().int().min(1).max(20),
            image,
            source,
            note: text.optional(),
            noteEn: text.optional(),
            ingredients: z
              .array(
                z
                  .object({
                    ingredientId: id,
                    grams: z.number().positive().max(100000),
                    quantity: z
                      .object({
                        kind: z.enum(["mass", "volume", "spoon", "count"]),
                        value: z.number().positive(),
                        label: z.string().optional(),
                        labelEn: z.string().optional(),
                      })
                      .strict(),
                    note: z.string().optional(),
                    optional: z.boolean().optional(),
                  })
                  .strict(),
              )
              .min(1),
            steps: z
              .array(
                z
                  .object({
                    title: text,
                    titleEn: text,
                    text,
                    textEn: text,
                    image,
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
    assets: z
      .array(
        z
          .object({
            id,
            mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
            data: z
              .string()
              .regex(/^[A-Za-z0-9+/]*={0,2}$/)
              .min(4)
              .max(4000000),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
const [file, owner, output] = process.argv.slice(2);
if (!file || !z.uuid().safeParse(owner).success)
  throw Error(
    "Usage: node scripts/publish-recipes.mjs PRIVATE_CATALOG.json OWNER_UUID [PRIVATE_OUTPUT.sql]",
  );
const catalog = schema.parse(JSON.parse(readFileSync(file, "utf8")));
for (const collection of [catalog.recipes, catalog.ingredients, catalog.assets])
  if (new Set(collection.map((x) => x.id)).size !== collection.length)
    throw Error("Duplicate canonical ID");
const ingredients = new Set(catalog.ingredients.map((i) => i.id)),
  assets = new Set(catalog.assets.map((i) => i.id));
for (const recipe of catalog.recipes) {
  for (const line of recipe.ingredients)
    if (!ingredients.has(line.ingredientId))
      throw Error(`Missing ingredient: ${line.ingredientId}`);
  for (const asset of [recipe.image, ...recipe.steps.map((s) => s.image)])
    if (!assets.has(asset.split("/").at(-1)))
      throw Error(`Missing asset: ${asset}`);
}
const q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const json = (o) => q(JSON.stringify(o)) + "::jsonb";
const sql = [
  "begin;",
  `create function pg_temp.assert_catalog(ok boolean, message text) returns void language plpgsql as $$ begin if not ok then raise exception '%', message; end if; end $$;`,
  `do $$ begin if not exists(select 1 from private.members where user_id=${q(owner)}::uuid) then raise exception 'Owner is not an invited member'; end if; end $$;`,
];
for (const { id, ...details } of catalog.ingredients) {
  // Reusing a canonical ID must never silently change historical nutrition.
  sql.push(
    `select pg_temp.assert_catalog(not exists(select 1 from public.ingredients where owner_id=${q(owner)} and id=${q(id)} and details is distinct from ${json(details)}), ${q("Ingredient " + id + " differs from its canonical definition: review explicitly")});`,
  );
  sql.push(
    `insert into public.ingredients(owner_id,id,details) values(${q(owner)},${q(id)},${json(details)}) on conflict(owner_id,id) do nothing;`,
  );
}
for (const a of catalog.assets)
  sql.push(
    `insert into public.recipe_assets(owner_id,id,mime,data) values(${q(owner)},${q(a.id)},${q(a.mime)},${q(a.data)}) on conflict(owner_id,id) do update set mime=excluded.mime,data=excluded.data;`,
  );
for (const { id, ingredients, ...details } of catalog.recipes) {
  sql.push(
    `insert into public.recipes(owner_id,id,details) values(${q(owner)},${q(id)},${json(details)}) on conflict(owner_id,id) do update set details=excluded.details;`,
  );
  sql.push(
    `delete from public.recipe_ingredients where owner_id=${q(owner)} and recipe_id=${q(id)};`,
  );
  ingredients.forEach((l, i) =>
    sql.push(
      `insert into public.recipe_ingredients(owner_id,recipe_id,ingredient_id,position,grams,quantity,note,optional) values(${q(owner)},${q(id)},${q(l.ingredientId)},${i},${l.grams},${json(l.quantity)},${q(l.note || "")},${!!l.optional});`,
    ),
  );
}
sql.push("commit;");
if (output) writeFileSync(output, sql.join("\n"), { mode: 0o600 });
console.log(
  JSON.stringify({
    validated: true,
    recipes: catalog.recipes.length,
    ingredients: catalog.ingredients.length,
    images: catalog.assets.length,
    sqlWritten: !!output,
  }),
);

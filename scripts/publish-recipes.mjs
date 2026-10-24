// Produce a transaction for review; applying it is a separate authenticated administrator action.
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { validateCatalog } from "./recipe-import-schema.mjs";
const [file, owner, output] = process.argv.slice(2);
if (!file || !z.uuid().safeParse(owner).success)
  throw Error(
    "Usage: node scripts/publish-recipes.mjs PRIVATE_CATALOG.json OWNER_UUID [PRIVATE_OUTPUT.sql]",
  );
const catalog = validateCatalog(JSON.parse(readFileSync(file, "utf8")));
for (const collection of [catalog.recipes, catalog.ingredients, catalog.assets])
  if (new Set(collection.map((x) => x.id)).size !== collection.length)
    throw Error("Duplicate canonical ID");
const ingredients = new Set(catalog.ingredients.map((i) => i.id)),
  assets = new Set(catalog.assets.map((i) => i.id));
for (const recipe of catalog.recipes) {
  for (const line of recipe.ingredients)
    if (!ingredients.has(line.ingredientId))
      throw Error(`Missing ingredient: ${line.ingredientId}`);
  for (const asset of [recipe.image, ...recipe.steps.flatMap((s) => s.image ? [s.image] : [])])
    if (catalog.assets.length && !assets.has(asset.split("/").at(-1)))
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
  for(const image of [details.image,...details.steps.flatMap(s=>s.image?[s.image]:[])])sql.push(`select pg_temp.assert_catalog(exists(select 1 from public.recipe_assets where owner_id=${q(owner)} and id=${q(image.split("/").at(-1))}), 'Missing private recipe image');`);
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

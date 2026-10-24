import { z } from "zod";
import { assertPreparations, flattenPreparations } from "./recipe-preparations.mjs";
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
const translations=z.object(Object.fromEntries(["fr","en","es","pt-BR"].map(l=>[l,z.record(z.string(),text)]))).strict();
const quantity=z.object({kind:z.enum(["mass","volume","spoon","count"]),value:z.number().positive(),label:z.string().optional(),labelEn:z.string().optional(),unit:z.enum(["piece","clove","bulb","can","pack","bunch","slice"]).optional(),gramsPerItem:z.number().positive().optional(),weightBasis:z.enum(["measured","package","estimated"]).optional(),content:z.object({kind:z.enum(["mass","volume"]),value:z.number().positive(),basis:z.enum(["net","drained"])}).strict().optional(),basis:z.enum(["net","drained"]).optional()}).strict();
const source = z.url().refine((v) => new URL(v).protocol === "https:");
export const schema = z
  .object({
    ingredients: z
      .array(
        z
          .object({
            id,
            name: text,
            nameEn: text,
            state: text,
            stockId:id.optional(),
            translations,
            nutrition,
            source,
            sourceLabel: text,
            sourceDescription: text,
            estimated: z.boolean(),
            aisle: z.enum(["produce", "meat", "fish", "dairy", "bakery", "dry", "seasoning", "frozen", "other"]).optional(),
          })
          .strict(),
      )
      .min(1),
    recipes: z
      .array(
        z
          .object({
            id,
            importVersion:z.literal(2),
            translations,
            provenance:z.object({importedAt:z.iso.datetime(),original:z.unknown(),decisions:z.array(text)}).strict(),
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
                    quantity,
                    note: z.string().optional(),
                    optional: z.boolean().optional(),
                  })
                  .strict(),
              )
              .min(1),
            preparations: z.array(z.object({id,title:text,titleEn:text,ingredients:z.array(z.object({ingredientId:id,grams:z.number().positive(),quantity}).strict()).min(1)}).strict()).optional(),
            steps: z
              .array(
                z
                  .object({
                    title: text,
                    titleEn: text,
                    text,
                    textEn: text,
                    image: image.optional(),
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
      .default([]),
  })
  .strict();

export function validateCatalog(raw) {
 // Explicit direct-only input is expanded once; saved catalogs are already flat.
 const expanded={...raw,recipes:raw.recipes?.map(recipe=>{
  if(recipe.ingredientLayout!=="direct-only")return recipe;
  const {ingredientLayout,...rest}=recipe;return flattenPreparations(rest);
 })};
 const catalog=schema.parse(expanded);
 const tokens=s=>(s.match(/\{\{[^}]+\}\}/g)||[]).sort().join("|");
 for(const list of [catalog.recipes,catalog.ingredients,catalog.assets])if(new Set(list.map(x=>x.id)).size!==list.length)throw Error("Duplicate canonical ID");
 const ids=new Set(catalog.ingredients.map(i=>i.id));
 for(const ingredient of catalog.ingredients){
  if(ingredient.stockId&&(!ids.has(ingredient.stockId)||ingredient.stockId===ingredient.id||catalog.ingredients.find(i=>i.id===ingredient.stockId).stockId))throw Error("Invalid stock identity");
  for(const locale of ["fr","en","es","pt-BR"])if(!ingredient.translations[locale][ingredient.name])throw Error(`Missing ingredient translation ${locale}: ${ingredient.id}`);
 }
 for(const r of catalog.recipes){
  assertPreparations(r,catalog.ingredients);
  const fields=[r.title,r.subtitle,r.note,...(r.preparations||[]).map(p=>p.title),...r.steps.flatMap(s=>[s.title,s.text]),...r.ingredients.map(l=>l.note)].filter(Boolean);
  for(const text of fields){
   for(const locale of ["fr","en","es","pt-BR"]){
    const translated=r.translations[locale][text];
    if(!translated||tokens(translated)!==tokens(text))throw Error(`Incomplete or inconsistent translation ${r.id} ${locale}`);
   }
   for(const match of text.matchAll(/\{\{qty:([a-z0-9-]+)\}\}/g))if(!r.ingredients.some(l=>l.ingredientId===match[1]))throw Error("Unknown quantity reference");
  }
  for(const line of r.ingredients){
   if(!ids.has(line.ingredientId))throw Error(`Missing ingredient: ${line.ingredientId}`);
   if(line.quantity.kind==="count"&&!line.quantity.unit)throw Error("Counted ingredient needs a stable unit");
   if(line.quantity.unit==="piece"&&line.quantity.kind!=="count")throw Error("Piece must be counted");
  }
 }
 return catalog;
}

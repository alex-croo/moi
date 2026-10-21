import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { applyPrivateMutation } from "../src/lib/private-mutations";
import { createVault, encryptVault, decryptVault } from "../src/lib/vault-crypto";
import { demoData } from "../src/lib/demo";
import type { PersonalData } from "../src/lib/private-types";

test("real database persists receipt and cooking together with stock, survives reload, and rejects stale or foreign writes", async () => {
  test.setTimeout(60000);
  const db = new PGlite(), owner = "11111111-1111-4111-8111-111111111111", admin = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${owner}','owner@example.test',now()),('${admin}','imalexgauthier@gmail.com',now());`);
    for (const file of (await readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(`insert into private.members(user_id,role) values('${owner}','member'),('${admin}','admin')`);
    const asUser = async (id: string) => { await db.exec("reset role;set role authenticated"); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); };
    const save = async (revision: number, data: PersonalData) => db.query("select public.save_standard_workspace($1,$2)",[revision,JSON.stringify(data)]);
    const reload = async () => (await db.query<{ data: PersonalData; revision: number }>("select data,revision from public.standard_workspaces")).rows[0];
    const catalog = { recipes: demoData.recipes, ingredients: demoData.ingredients };
    const { recipes: _r, ingredients: _i, ...base } = demoData;
    let personal: PersonalData = { ...base, pantry: [], slots: [{ date: "2026-10-25", slot: "lunch", recipeId: demoData.recipes[0].id }], program: { completed: {}, reflections: {} } };
    const orderId = crypto.randomUUID(), cookId = crypto.randomUUID();
    await asUser(owner);
    personal = applyPrivateMutation(personal, "shopping", { action: "order", id: orderId, mode: "store", grocer: "Private grocer", expectedDate: "2026-10-25", fulfillment: "pickup", lines: [{ ingredientId: "beef-95-raw", quantity: { kind: "mass", value: 500 }, location: "freezer" }] }, catalog);
    await save(0, personal);
    const received = await reload(); expect(received.data.pantry[0].quantity?.value).toBe(500); expect(received.data.shopping?.orders[0].status).toBe("received");
    personal = applyPrivateMutation(received.data, "shopping", { action: "cook", id: cookId, meal: personal.slots[0], portions: 2, includeOptional: false }, catalog);
    await save(1, personal);
    await expect(save(1, received.data)).rejects.toThrow(/Workspace changed/);
    expect((await reload()).data.pantry[0].quantity?.value).toBe(250);
    await asUser(admin);
    expect(await reload()).toBeUndefined();
    await db.query("update public.standard_workspaces set data='{}' where owner_id=$1", [owner]).then(() => { throw Error("direct write unexpectedly allowed"); }, error => expect(String(error)).toMatch(/permission/));
    await asUser(owner);
    const sealed = await createVault(owner, "Synthetic strong phrase for testing 42!", personal);
    await db.query("select public.activate_personal_vault($1,$2)", [2, JSON.stringify(sealed.envelope)]);
    expect(await reload()).toBeUndefined();
    const opened = await decryptVault<PersonalData>(sealed.key, sealed.envelope, owner);
    const undone = applyPrivateMutation(opened, "shopping", { action: "undoCook", id: cookId }, catalog);
    const updated = await encryptVault(sealed.key, sealed.envelope, undone);
    await db.query("select public.save_personal_vault($1,$2)",[1, JSON.stringify(updated)]);
    const readback = (await db.query<{ envelope: typeof updated }>("select envelope from public.personal_vaults")).rows[0].envelope;
    expect(JSON.stringify(readback)).not.toContain("Private grocer");
    expect((await decryptVault<PersonalData>(sealed.key, readback, owner)).pantry[0].quantity?.value).toBe(500);
    await asUser(admin); expect((await db.query("select envelope from public.personal_vaults")).rows).toHaveLength(0);
  } finally { await db.close(); }
});

import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

test("database enforces invitation and ownership for every private table", async () => {
  test.setTimeout(60000);
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const stranger = "33333333-3333-4333-8333-333333333333";
  try {
    // Only Supabase's auth schema is emulated; the application migration and
    // PostgreSQL role/RLS checks execute unchanged in the embedded database.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('${owner}', 'owner@example.test', now()), ('${other}', 'other@example.test', now()), ('${stranger}', 'stranger@example.test', now());
    `);
    await db.exec(
      await readFile("supabase/migrations/001_private_workspace.sql", "utf8"),
    );
    await db.exec(
      `insert into private.members (user_id) values ('${owner}'), ('${other}');`,
    );
    const asUser = async (id: string) => {
      await db.exec("reset role; set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
        id,
      ]);
    };
    await asUser(owner);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.current_user_allowed() as allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
    await db.exec(`
      insert into weight_entries (date,value,unit) values ('2026-10-18', 185.6, 'lb');
      insert into journal_entries (date,text,mood) values ('2026-10-18','Private owner note',4);
      insert into document_links (title,url,kind) values ('Private document','https://docs.google.com/document/d/test','journal');
      insert into menu_plans (title,title_en,start_date,days) values ('Ma semaine','My week','2026-10-26','[{}, {}, {}, {}, {}, {}]');
    `);
    const tables = [
      "weight_entries",
      "journal_entries",
      "document_links",
      "menu_plans",
    ];
    for (const table of tables)
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(1);
    await asUser(other);
    for (const table of tables) {
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
      expect(
        (await db.query(`delete from ${table} returning id`)).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            `update ${table} set owner_id = '${other}' returning id`,
          )
        ).rows,
      ).toHaveLength(0);
    }
    await expect(
      db.exec(
        `insert into weight_entries(owner_id,date,value,unit) values('${owner}','2026-10-19',180,'lb')`,
      ),
    ).rejects.toThrow(/row-level security/i);
    await expect(
      db.exec(`insert into private.members(user_id) values('${stranger}')`),
    ).rejects.toThrow(/permission denied/i);
    await asUser(stranger);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.current_user_allowed() as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    for (const table of tables)
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    await expect(
      db.exec(
        "insert into journal_entries(date,text,mood) values('2026-10-18','Not invited',3)",
      ),
    ).rejects.toThrow(/row-level security/i);
    await db.exec("reset role; set role anon");
    for (const table of tables)
      await expect(db.query(`select * from ${table}`)).rejects.toThrow(
        /permission denied/i,
      );
    await db.exec(
      `reset role; delete from private.members where user_id='${owner}';`,
    );
    await asUser(owner);
    for (const table of tables)
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    await expect(
      db.exec(
        "insert into weight_entries(date,value,unit) values('2026-10-19',180,'lb')",
      ),
    ).rejects.toThrow(/row-level security/i);
  } finally {
    await db.close();
  }
});

test("catalog isolation, canonical references, journal concurrency, preferences and AI quotas", async () => {
  test.setTimeout(60000);
  const db = new PGlite();
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222",
    c = "33333333-3333-4333-8333-333333333333";
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; insert into auth.users values('${a}'),('${b}'),('${c}');`,
    );
    await db.exec(
      await readFile("supabase/migrations/001_private_workspace.sql", "utf8"),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20261019122611_recipe_library_weekly_planner_journal_ai.sql",
        "utf8",
      ),
    );
    await db.exec(
      `insert into private.members values('${a}',now()),('${b}',now()); insert into public.ingredients values('${a}','beef','{}'); insert into public.recipes values('${a}','chili','{}'),('${a}','burger','{}'),('${b}','foreign','{}'); insert into public.recipe_assets values('${a}','photo','image/jpeg','YWJj'); insert into public.recipe_ingredients values('${a}','chili','beef',0,250,'{}','',false),('${a}','burger','beef',0,500,'{}','',false);`,
    );
    const asUser = async (id: string) => {
      await db.exec("reset role;set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
    };
    const catalog = [
      "ingredients",
      "recipes",
      "recipe_assets",
      "recipe_ingredients",
    ];
    await asUser(a);
    expect((await db.query("select * from ingredients")).rows).toHaveLength(1);
    expect(
      (await db.query("select * from recipe_ingredients")).rows,
    ).toHaveLength(2);
    await expect(
      db.exec(`insert into ingredients values('${a}','new','{}')`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec(`update ingredients set details='{"kcal":0}'`),
    ).rejects.toThrow(/permission denied/);
    await db.exec(
      "insert into meal_slots(date,slot,recipe_id) values('2026-10-25','dinner','chili')",
    );
    await expect(
      db.exec(
        "insert into meal_slots(date,slot,recipe_id) values('2026-10-26','lunch','foreign')",
      ),
    ).rejects.toThrow(/foreign key/);
    const units = {
      bodyMass: "kg",
      ingredientMass: "oz",
      volume: "cup",
      spoons: "ml",
      temperature: "F",
      length: "in",
    };
    await db.query("insert into unit_preferences(units) values($1)", [
      JSON.stringify(units),
    ]);
    expect(
      (await db.query<{ units: object }>("select units from unit_preferences"))
        .rows[0].units,
    ).toEqual(units);
    await expect(
      db.exec("update unit_preferences set units='{}'"),
    ).rejects.toThrow(/check constraint/);
    await db.exec(
      "select save_journal('2026-10-19',E'Line one\n\nLine two','My page',3,0)",
    );
    await db.exec(
      "select save_journal('2026-10-19',E'Edited\n\nLine two','My page',4,1)",
    );
    await expect(
      db.exec("select save_journal('2026-10-19','Stale','Old',3,1)"),
    ).rejects.toThrow(/Journal changed/);
    expect(
      (
        await db.query<{ text: string; revision: number }>(
          "select text,revision from journal_entries",
        )
      ).rows[0],
    ).toEqual({ text: "Edited\n\nLine two", revision: 2 });
    for (let i = 0; i < 20; i++)
      expect(
        (await db.query<{ ok: boolean }>("select reserve_ai_edit() as ok"))
          .rows[0].ok,
      ).toBe(true);
    expect(
      (await db.query<{ ok: boolean }>("select reserve_ai_edit() as ok"))
        .rows[0].ok,
    ).toBe(false);
    await expect(
      db.query("select * from private.ai_edit_usage"),
    ).rejects.toThrow(/permission denied/);
    await asUser(b);
    for (const table of [
      "ingredients",
      "recipe_assets",
      "recipe_ingredients",
      "meal_slots",
      "unit_preferences",
      "journal_entries",
    ])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    await expect(
      db.exec(
        `insert into meal_slots(owner_id,date,slot,recipe_id) values('${a}','2026-10-26','lunch','chili')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await asUser(c);
    for (const table of [...catalog, "meal_slots", "unit_preferences"])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    expect(
      (await db.query<{ ok: boolean }>("select reserve_ai_edit() as ok"))
        .rows[0].ok,
    ).toBe(false);
    await db.exec("reset role;set role anon");
    for (const table of [...catalog, "meal_slots", "unit_preferences"])
      await expect(db.query(`select * from ${table}`)).rejects.toThrow(
        /permission denied/,
      );
    await expect(db.query("select reserve_ai_edit()")).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

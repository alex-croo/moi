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

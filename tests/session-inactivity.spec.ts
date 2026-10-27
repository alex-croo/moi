import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

test("30-day idle limit is server enforced, scoped per login, and cannot be revived by a refresh or heartbeat", async () => {
  test.setTimeout(60000);
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
  const session = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", second = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", foreign = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
      grant usage on schema auth,private to authenticated;
      create table auth.users(id uuid primary key);
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz,not_after timestamptz,refreshed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('session_id',current_setting('test.session',true)) $$;
      create function public.current_user_allowed() returns boolean language sql stable as $$ select auth.uid() is not null $$;
      insert into auth.users values('${owner}'),('${other}');
      insert into auth.sessions values('${session}','${owner}',now()-interval '2 days',null,now()),('${second}','${owner}',now(),null,now()),('${foreign}','${other}',now(),null,now());`);
    await db.exec(await readFile("supabase/migrations/20261027130811_app_session_inactivity.sql", "utf8"));
    const as = async (id: string, sid: string) => { await db.exec("reset role;set role authenticated"); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('test.session',$2,false)", [id,sid]); };
    const status = async (touch = false) => (await db.query<{ result: { active: boolean; expiresAt?: string } }>("select public.app_session_status($1) as result", [touch])).rows[0].result;
    await as(owner, session);
    const before = await status(); expect(before.active).toBe(true);
    expect((await status()).expiresAt).toBe(before.expiresAt); // background reads do not extend
    expect(Date.parse((await status(true)).expiresAt!)).toBeGreaterThan(Date.parse(before.expiresAt!));
    await expect(db.exec("select * from private.app_session_activity")).rejects.toThrow(/permission denied/i);
    await db.exec("reset role");
    await db.exec(`update private.app_session_activity set last_active_at=now()-interval '30 days' where session_id='${session}';update auth.sessions set refreshed_at=now() where id='${session}';`);
    await as(owner, session); expect((await status()).active).toBe(false); expect((await status(true)).active).toBe(false);
    await as(owner, second); expect((await status(true)).active).toBe(true); // fresh login on same account
    await as(owner, foreign); expect((await status(true)).active).toBe(false); // cannot touch another owner's session
    await as(other, foreign); expect((await status()).active).toBe(true);
    await db.exec(`reset role;delete from auth.sessions where id='${foreign}';`);
    await as(other, foreign); expect((await status()).active).toBe(false); // revoked session
    await as(owner, ""); expect((await status()).active).toBe(false);
    await as(owner, "malformed"); expect((await status()).active).toBe(false);
    await db.exec("reset role;set role anon");
    await expect(status()).rejects.toThrow(/permission denied/i);
  } finally { await db.close(); }
});

test("all private routes share the inactivity gate and activity requires same-origin", async () => {
  const auth = await readFile("src/lib/supabase.ts", "utf8");
  expect(auth).toContain('db.rpc("app_session_status", { touch })');
  expect(auth.indexOf("db.auth.getUser()")).toBeLessThan(auth.indexOf('db.rpc("app_session_status"'));
  const route = await readFile("src/app/api/session/route.ts", "utf8");
  expect(route.indexOf("!sameOrigin(request)")).toBeLessThan(route.indexOf("authorizedClient(true)"));
  expect(route).toContain('scope: "local"');
});

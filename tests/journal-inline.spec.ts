import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import {
  journalChanges,
  applyJournalSuggestion,
} from "../src/lib/journal-revision";
import { handleJournalEdit } from "../src/lib/journal-ai";

test("inline changes preserve accents, spaces, blank lines and both original/final text", () => {
  for (const [before, after] of [
    [
      "Je suis aller marché.\n\nJ’ai aimer ça!",
      "Je suis allé marcher.\n\nJ’ai aimé ça!",
    ],
    ["  Une phrase  ", "  Une belle phrase  "],
    ["🍎 Ça va?\n\nOui.", "🍎 Ça va ?\n\nOui!"],
    ["a\n\nb", "a\nb"],
    ["sans changement", "sans changement"],
    ["a ".repeat(1800), "b ".repeat(1800)],
  ]) {
    const diff = journalChanges(before, after);
    expect(
      diff
        .filter((p) => p.kind !== "add")
        .map((p) => p.text)
        .join(""),
    ).toBe(before);
    expect(
      diff
        .filter((p) => p.kind !== "remove")
        .map((p) => p.text)
        .join(""),
    ).toBe(after);
  }
  const diff = journalChanges(
    "Je suis aller marcher.",
    "Je suis allé marcher.",
  );
  expect(
    diff
      .filter((p) => p.kind === "remove")
      .map((p) => p.text)
      .join(""),
  ).toBe("aller");
});

test("accept changes only the selection, rejects stale or oversized revisions", () => {
  const original = "Avant.\n\nJe suis aller marché.\n\nAprès.";
  const start = original.indexOf("Je"),
    end = original.indexOf("\n\nAprès");
  const proposal = { original, start, end, text: "Je suis allé marcher." };
  expect(applyJournalSuggestion(original, proposal)).toBe(
    "Avant.\n\nJe suis allé marcher.\n\nAprès.",
  );
  expect(() => applyJournalSuggestion(original + "!", proposal)).toThrow(
    "stale",
  );
  expect(() =>
    applyJournalSuggestion(original, { ...proposal, text: "x".repeat(20000) }),
  ).toThrow("too_long");
});

test("AI rejects encrypted, anonymous, suspended, cross-origin and uncertain accounts without reading journal content", async () => {
  for (const mode of [
    "encrypted",
    "anonymous",
    "suspended",
    "cross-origin",
    "error",
  ]) {
    let reads = 0,
      calls = 0;
    const request = new Request("https://iamable.space/api/journal/edit", {
      method: "POST",
      headers: {
        origin:
          mode === "cross-origin"
            ? "https://other.test"
            : "https://iamable.space",
        "content-type": "application/json",
      },
      body: "{}",
    });
    Object.defineProperty(request, "body", {
      get() {
        reads++;
        throw Error("must not read");
      },
    });
    const response = await handleJournalEdit(request, {
      origin: "https://iamable.space",
      authorize: async () => {
        if (mode === "error") throw Error("db");
        return mode === "anonymous" || mode === "suspended"
          ? null
          : { encrypted: true, reserve: async () => true };
      },
      generate: async () => {
        calls++;
        return { text: "unused", finishReason: "stop" };
      },
    });
    expect(response.status).toBe(
      (
        {
          encrypted: 409,
          anonymous: 401,
          suspended: 401,
          "cross-origin": 403,
          error: 503,
        } as Record<string, number>
      )[mode],
    );
    expect(reads).toBe(0);
    expect(calls).toBe(0);
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
});

test("standard AI validates selection, rate limits, respects cancellation and returns only a complete suggestion", async () => {
  const make = (body: unknown) =>
    new Request("https://iamable.space/api/journal/edit", {
      method: "POST",
      headers: {
        origin: "https://iamable.space",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const received: unknown[] = [];
  let permitted = true,
    finishReason = "stop",
    providerFails = false;
  const deps = {
    origin: "https://iamable.space",
    authorize: async () => ({
      encrypted: false,
      reserve: async () => permitted,
    }),
    generate: async (input: unknown) => {
      received.push(input);
      if (providerFails) throw Error("PRIVATE TEXT FROM PROVIDER");
      return { text: "Je suis allé marcher.", finishReason };
    },
  };
  const selection = { action: "correct", text: "Je suis aller marché." };
  expect((await handleJournalEdit(make(selection), deps)).status).toBe(200);
  expect(received).toEqual([selection]);
  for (const invalid of [
    { ...selection, text: " " },
    { ...selection, text: "x".repeat(8001) },
    { ...selection, action: "unknown" },
    { ...selection, journal: "full page" },
  ])
    expect((await handleJournalEdit(make(invalid), deps)).status).toBe(400);
  expect(received).toHaveLength(1);
  permitted = false;
  expect((await handleJournalEdit(make(selection), deps)).status).toBe(429);
  expect(received).toHaveLength(1);
  permitted = true;
  finishReason = "length";
  expect((await handleJournalEdit(make(selection), deps)).status).toBe(502);
  providerFails = true;
  const failed = await handleJournalEdit(make(selection), deps);
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("PRIVATE");
  const controller = new AbortController();
  controller.abort();
  const cancelled = new Request(make(selection), { signal: controller.signal });
  const count = received.length;
  expect((await handleJournalEdit(cancelled, deps)).status).toBe(408);
  expect(received).toHaveLength(count);
});

test("database AI gate permits only active standard users, with independent hourly quotas", async () => {
  test.setTimeout(120000);
  const db = new PGlite(),
    a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(
      `create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}','imalexgauthier@gmail.com',now()),('${b}','member@example.test',now());`,
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.exec(
      `insert into private.members(user_id)values('${a}'),('${b}');set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`,
    );
    const reserve = async () =>
      (
        await db.query<{ allowed: boolean }>(
          "select public.reserve_ai_edit() allowed",
        )
      ).rows[0].allowed;
    for (let i = 0; i < 20; i++) expect(await reserve()).toBe(true);
    expect(await reserve()).toBe(false);
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
    expect(await reserve()).toBe(true);
    await db.exec(
      `reset role;insert into public.personal_vaults(owner_id,revision,envelope)values('${b}',1,'{}');set role authenticated;`,
    );
    expect(await reserve()).toBe(false);
    await db.exec(
      `reset role;delete from public.personal_vaults where owner_id='${b}';update private.members set active=false where user_id='${b}';set role authenticated;`,
    );
    expect(await reserve()).toBe(false);
    await db.exec("reset role;set role anon");
    await expect(reserve()).rejects.toThrow(/permission denied/);
  } finally {
    await db.close();
  }
});

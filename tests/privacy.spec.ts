import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import {
  createVault,
  unlockVault,
  decryptVault,
  encryptVault,
  changeVaultPassphrase,
  unlockVaultWithPasskey,
} from "../src/lib/vault-crypto";
import {
  lessons,
  completeLesson,
  programState,
} from "../src/lib/daily-program";
import type { ProgramProgress } from "../src/lib/private-types";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  c = "33333333-3333-4333-8333-333333333333",
  d = "44444444-4444-4444-8444-444444444444";
const pass = "Synthetic test phrase only 42!",
  otherPass = "Different synthetic phrase 99!";
test("client vault protects plaintext, binds owner/revision, detects tampering and recovers without admin", async () => {
  const personal = {
    journal: [{ title: "Private title", text: "A private thought", mood: 3 }],
    weights: [{ value: 84 }],
    program: { completed: {}, reflections: {} },
  };
  const first = await createVault(a, pass, personal),
    second = await createVault(b, pass, { journal: [] });
  expect(JSON.stringify(first.envelope)).not.toContain("Private");
  expect(JSON.stringify(first.envelope)).not.toContain(pass);
  expect(JSON.stringify(first.envelope)).not.toContain(first.recoveryCode);
  expect(
    await decryptVault(
      await unlockVault(first.envelope, a, pass),
      first.envelope,
      a,
    ),
  ).toEqual(personal);
  await expect(unlockVault(first.envelope, a, otherPass)).rejects.toThrow();
  await expect(unlockVault(first.envelope, b, pass)).rejects.toThrow();
  await expect(decryptVault(second.key, first.envelope, a)).rejects.toThrow();
  const tampered = structuredClone(first.envelope);
  tampered.payload.ciphertext =
    (tampered.payload.ciphertext[0] === "A" ? "B" : "A") +
    tampered.payload.ciphertext.slice(1);
  await expect(decryptVault(first.key, tampered, a)).rejects.toThrow();
  await expect(
    decryptVault(first.key, { ...first.envelope, revision: 2 }, a),
  ).rejects.toThrow();
  const next = await encryptVault(first.key, first.envelope, personal);
  expect(next.payload.iv).not.toBe(first.envelope.payload.iv);
  expect(next.revision).toBe(2);
  const recoveryKey = await unlockVault(
    first.envelope,
    a,
    first.recoveryCode,
    true,
  );
  expect(await decryptVault(recoveryKey, first.envelope, a)).toEqual(personal);
  const reset = await changeVaultPassphrase(
    first.envelope,
    a,
    first.recoveryCode,
    otherPass,
  );
  expect(
    await decryptVault(await unlockVault(reset, a, otherPass), reset, a),
  ).toEqual(personal);
  await expect(unlockVault(reset, a, pass)).rejects.toThrow();
  const backup = JSON.parse(JSON.stringify(next));
  expect(
    await decryptVault(
      await unlockVault(backup, a, first.recoveryCode, true),
      backup,
      a,
    ),
  ).toEqual(personal);
});
test("31 days unlock in order immediately, retain progress and complete four milestones", () => {
  expect(lessons).toHaveLength(31);
  expect(new Set(lessons.map((l) => l.id)).size).toBe(31);
  let p: ProgramProgress = {
    completed: {},
    reflections: { private: "kept locally" },
  };
  expect(() => completeLesson(p, lessons[1].id, "2026-10-19")).toThrow();
  p = completeLesson(p, lessons[0].id, "2026-10-19");
  expect(programState(p)).toMatchObject({
    index: 1,
    completed: 1,
    available: true,
  });
  expect(() => completeLesson(p, lessons[0].id, "2026-10-19")).toThrow();
  expect(() => completeLesson(p, lessons[2].id, "2026-10-20")).toThrow();
  p = completeLesson(p, lessons[1].id, "2026-10-19");
  expect(programState(p)).toMatchObject({
    index: 2,
    completed: 2,
    available: true,
  });
  expect(p.reflections.private).toBe("kept locally");
  for (let i = 2; i < 31; i++)
    p = completeLesson(
      p,
      lessons[i].id,
      `2026-11-${String(i).padStart(2, "0")}`,
    );
  expect(programState(p)).toMatchObject({
    finished: true,
    completed: 31,
    available: false,
  });
  expect(() => completeLesson(p, lessons[30].id, "2026-12-01")).toThrow();
  for (const lesson of lessons) {
    expect(lesson.body[0].length).toBeGreaterThan(300);
    expect(lesson.body[1].length).toBeGreaterThan(250);
  }
});
test("real PostgreSQL: migration, vault isolation including admin, invitations, circles and immediate revocation", async () => {
  test.setTimeout(120000);
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}','imalexgauthier@gmail.com',now()),('${b}','member@example.test',now()),('${c}','stranger@example.test',now()),('${d}','unverified@example.test',null);`,
    );
    const files = (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (file.includes("private_vault"))
        await db.exec(
          `insert into private.members(user_id) values('${a}');insert into journal_entries(owner_id,date,text,mood) values('${a}','2026-10-19','Legacy private data',3);insert into weight_entries(owner_id,date,value,unit)values('${a}','2026-10-19',80,'kg');`,
        );
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    const as = async (id: string) => {
      await db.exec("reset role;set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
    };
    const rpc = async (name: string, args: unknown[] = []) => {
      const result = await db.query<{ value: any }>(
        `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as value`,
        args,
      );
      return result.rows[0].value;
    };
    const va = await createVault(a, pass, { journal: ["Legacy private data"] }),
      vb = await createVault(b, otherPass, {
        journal: ["Member private data"],
      });
    await as(a);
    expect(await rpc("current_user_admin")).toBe(true);
    expect(
      (await rpc("manage_platform", ["invite", "member@example.test"]))
        .invitations.length,
    ).toBe(1);
    await expect(
      db.exec(
        "insert into journal_entries(date,text,mood)values('2026-10-20','plaintext',3)",
      ),
    ).rejects.toThrow(/permission/);
    await expect(
      rpc("save_journal", ["2026-10-19", "plaintext", "title", 3, 1]),
    ).rejects.toThrow(/permission/);
    expect(
      (await db.query("select text from journal_entries")).rows,
    ).toHaveLength(1);
    await expect(
      rpc("save_personal_vault", [0, JSON.stringify(vb.envelope)]),
    ).rejects.toThrow(/Invalid/);
    expect(
      await rpc("save_personal_vault", [0, JSON.stringify(va.envelope)]),
    ).toBe(1);
    expect((await db.query("select * from journal_entries")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from weight_entries")).rows).toHaveLength(
      0,
    );
    await expect(
      rpc("save_personal_vault", [0, JSON.stringify(va.envelope)]),
    ).rejects.toThrow(/Vault changed/);
    await rpc("manage_platform", ["invite", "member@example.test"]);
    await db.exec("reset role;set role supabase_auth_admin");
    expect(
      await rpc("before_invited_user_created", [
        JSON.stringify({
          user: {
            email: "member@example.test",
            app_metadata: { provider: "google" },
          },
        }),
      ]),
    ).toEqual({});
    expect(
      await rpc("before_invited_user_created", [
        JSON.stringify({
          user: {
            email: "stranger@example.test",
            app_metadata: { provider: "google" },
          },
        }),
      ]),
    ).toHaveProperty("error");
    expect(
      await rpc("before_invited_user_created", [
        JSON.stringify({
          user: {
            email: "member@example.test",
            app_metadata: { provider: "email" },
            user_metadata: { provider: "google" },
          },
        }),
      ]),
    ).toHaveProperty("error");
    await as(c);
    expect(await rpc("claim_platform_invitation")).toBe(false);
    await expect(rpc("manage_platform", ["list", ""])).rejects.toThrow(
      /Forbidden/,
    );
    await as(b);
    expect(await rpc("claim_platform_invitation")).toBe(true);
    expect(await rpc("current_user_admin")).toBe(false);
    await expect(
      rpc("manage_platform", ["invite", "stranger@example.test"]),
    ).rejects.toThrow(/Forbidden/);
    expect((await db.query("select * from personal_vaults")).rows).toHaveLength(
      0,
    );
    await expect(
      rpc("save_personal_vault", [
        1,
        JSON.stringify({ ...va.envelope, revision: 2 }),
      ]),
    ).rejects.toThrow();
    expect(
      await rpc("save_personal_vault", [0, JSON.stringify(vb.envelope)]),
    ).toBe(1);
    await as(a);
    expect((await db.query("select * from personal_vaults")).rows).toHaveLength(
      1,
    );
    const admin = await rpc("manage_platform", ["list", ""]);
    expect(JSON.stringify(admin)).not.toContain("Member private data");
    expect(admin.members).toHaveLength(2);
    const circle = await rpc("circle_action", [
      "create",
      null,
      "Family",
      "Alex",
    ]);
    await rpc("circle_action", ["invite", circle, "member@example.test", ""]);
    const invite = (
      await db.query<{ id: string }>("select id from circle_invitations")
    ).rows[0].id;
    await as(c);
    await expect(
      rpc("circle_action", ["accept", invite, "", "Stranger"]),
    ).rejects.toThrow(/Forbidden/);
    await as(b);
    expect((await db.query("select * from circles")).rows).toHaveLength(0);
    expect(
      (await db.query("select circle_name from circle_invitations")).rows,
    ).toEqual([{ circle_name: "Family" }]);
    await rpc("circle_action", ["accept", invite, "", "Friend"]);
    expect((await db.query("select * from circles")).rows).toHaveLength(1);
    await rpc("circle_action", ["post", circle, "encourage", ""]);
    await expect(
      rpc("circle_action", ["post", circle, "Private journal content", ""]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      rpc("circle_action", ["remove", circle, a, ""]),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      db.exec(
        `insert into circle_members values('${circle}','${c}','stranger')`,
      ),
    ).rejects.toThrow(/permission/);
    const ownCircle = await rpc("circle_action", [
      "create",
      null,
      "Private friends",
      "Friend",
    ]);
    await as(a);
    expect((await db.query("select * from circles")).rows).toHaveLength(1);
    expect(
      (
        await db.query(
          `select * from circle_members where circle_id='${ownCircle}'`,
        )
      ).rows,
    ).toHaveLength(0);
    await rpc("circle_action", ["remove", circle, b, ""]);
    await as(b);
    expect(
      (
        await db.query(
          `select * from circle_events where circle_id='${circle}'`,
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      rpc("circle_action", ["post", circle, "encourage", ""]),
    ).rejects.toThrow(/Forbidden/);
    await as(a);
    await rpc("manage_platform", ["suspend", b]);
    await as(b);
    expect(await rpc("current_user_allowed")).toBe(false);
    expect((await db.query("select * from personal_vaults")).rows).toHaveLength(
      0,
    );
    expect(await rpc("claim_platform_invitation")).toBe(false);
    await as(a);
    await rpc("manage_platform", ["invite", "unverified@example.test"]);
    await as(d);
    expect(await rpc("claim_platform_invitation")).toBe(false);
    await as(a);
    await rpc("manage_platform", ["invite", "stranger@example.test"]);
    const invites = await rpc("manage_platform", ["list", ""]);
    const ci = invites.invitations.find(
      (i: any) => i.email === "stranger@example.test",
    );
    await rpc("manage_platform", ["cancel", ci.id]);
    await as(c);
    expect(await rpc("claim_platform_invitation")).toBe(false);
    await db.exec("reset role;set role anon");
    for (const table of [
      "personal_vaults",
      "circles",
      "circle_members",
      "circle_invitations",
      "circle_events",
    ])
      await expect(db.query(`select * from ${table}`)).rejects.toThrow(
        /permission/,
      );
    for (const [name, args] of [
      ["current_user_admin", []],
      ["claim_platform_invitation", []],
      ["save_personal_vault", [0, JSON.stringify(va.envelope)]],
      ["manage_platform", ["list", ""]],
      ["circle_action", ["create", null, "Bad", "Bad"]],
    ] as [string, unknown[]][])
      await expect(rpc(name, args)).rejects.toThrow(/permission/);
  } finally {
    await db.close();
  }
});

test("passkey-encrypted vault has no server secret, recovers without passkey and rejects wrong PRF", async () => {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const original = secret.slice();
  const saved = await createVault(
    a,
    null,
    { journal: ["Existing thoughts"], weights: [82] },
    {
      id: "synthetic-credential",
      salt: "test-input",
      rpId: "iamable.space",
      secret,
    },
  );
  expect(secret.every((x) => x === 0)).toBe(true);
  expect(saved.envelope.password).toBeNull();
  expect(JSON.stringify(saved.envelope)).not.toContain("Existing thoughts");
  expect(JSON.stringify(saved.envelope)).not.toContain(
    btoa(String.fromCharCode(...original)),
  );
  const key = await unlockVaultWithPasskey(
    saved.envelope,
    a,
    "synthetic-credential",
    original.slice(),
  );
  expect(await decryptVault(key, saved.envelope, a)).toEqual({
    journal: ["Existing thoughts"],
    weights: [82],
  });
  await expect(
    unlockVaultWithPasskey(
      saved.envelope,
      a,
      "synthetic-credential",
      new Uint8Array(32),
    ),
  ).rejects.toThrow();
  await expect(
    unlockVault(saved.envelope, a, "any-password"),
  ).rejects.toThrow();
  expect(
    await decryptVault(
      await unlockVault(saved.envelope, a, saved.recoveryCode, true),
      saved.envelope,
      a,
    ),
  ).toEqual({ journal: ["Existing thoughts"], weights: [82] });
});

test("standard data is isolated, activation migrates all data atomically and rejects stale plaintext writes", async () => {
  test.setTimeout(120000);
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${a}','imalexgauthier@gmail.com',now()),('${b}','member@example.test',now());`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
    await db.exec(
      `insert into private.members(user_id,role) values('${a}','admin'),('${b}','member');`,
    );
    const as = async (id: string) => {
      await db.exec("reset role;set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
    };
    const rpc = async (name: string, args: unknown[]) =>
      (
        await db.query<{ v: any }>(
          `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) v`,
          args,
        )
      ).rows[0].v;
    const personal = {
      journal: [{ text: "All existing private data" }],
      shopping: { grocers: [{ name: "Private grocer" }], orders: [{ id: "private-order", status: "pending" }], cooked: [{ id: "private-cooking" }], selections: {} },
      weights: [{ value: 80 }],
      plans: [],
      slots: [],
      pantry: [],
      preferences: {},
      documents: [],
      groceryChecks: [],
      program: { completed: { day1: "2026-10-19" }, reflections: {} },
    };
    await as(b);
    expect(
      await rpc("save_standard_workspace", [0, JSON.stringify(personal)]),
    ).toBe(1);
    await rpc("circle_action", ["create", null, "My circle", "Me"]);
    await as(a);
    expect(
      (await db.query("select * from standard_workspaces")).rows,
    ).toHaveLength(0);
    await as(b);
    expect(
      (await db.query("select data from standard_workspaces")).rows[0],
    ).toEqual({ data: personal });
    await expect(
      rpc("save_standard_workspace", [0, JSON.stringify(personal)]),
    ).rejects.toThrow(/Workspace changed/);
    const sealed = await createVault(b, pass, personal);
    expect(JSON.stringify(sealed.envelope)).not.toContain("Private grocer");
    expect(await decryptVault(sealed.key, sealed.envelope, b)).toEqual(personal);
    await expect(
      rpc("activate_personal_vault", [0, JSON.stringify(sealed.envelope)]),
    ).rejects.toThrow(/Workspace changed/);
    await expect(
      rpc("save_personal_vault", [0, JSON.stringify(sealed.envelope)]),
    ).rejects.toThrow(/Activation required/);
    await expect(
      rpc("activate_personal_vault", [
        1,
        JSON.stringify({ ...sealed.envelope, ownerId: a }),
      ]),
    ).rejects.toThrow(/Invalid/);
    expect(
      (await db.query("select data from standard_workspaces")).rows,
    ).toHaveLength(1);
    expect(
      await rpc("activate_personal_vault", [
        1,
        JSON.stringify(sealed.envelope),
      ]),
    ).toBe(1);
    expect(
      (await db.query("select * from standard_workspaces")).rows,
    ).toHaveLength(0);
    await expect(
      rpc("save_standard_workspace", [1, JSON.stringify(personal)]),
    ).rejects.toThrow(/Protection enabled/);
    await db.exec("reset role");
    expect(
      (await db.query("select * from standard_workspaces")).rows,
    ).toHaveLength(0);
    await as(a);
    expect((await db.query("select * from personal_vaults")).rows).toHaveLength(
      0,
    );
    await rpc("manage_platform", ["suspend", b]);
    await as(b);
    expect((await db.query("select * from personal_vaults")).rows).toHaveLength(
      0,
    );
    await expect(
      rpc("save_standard_workspace", [0, JSON.stringify(personal)]),
    ).rejects.toThrow(/Forbidden/);
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from standard_workspaces")).rejects.toThrow(
      /permission/,
    );
    for (const [name, args] of [
      ["save_standard_workspace", [0, JSON.stringify(personal)]],
      ["activate_personal_vault", [0, JSON.stringify(sealed.envelope)]],
    ] as [string, unknown[]][])
      await expect(rpc(name, args)).rejects.toThrow(/permission/);
  } finally {
    await db.close();
  }
});

test("browser PRF adapter checks capability, verifies a second assertion, and fails closed", async () => {
  const { createPasskeyMaterial, getPasskeySecret } = await import(
    "../src/lib/vault-passkeys"
  );
  const original = new Map(
    ["window", "location", "PublicKeyCredential", "navigator"].map((k) => [
      k,
      Object.getOwnPropertyDescriptor(globalThis, k),
    ]),
  );
  const calls: any[] = [];
  let supported = true,
    mismatch = false;
  const secret = new Uint8Array(32).fill(7),
    rawId = new Uint8Array([1, 2, 3]).buffer;
  try {
    Object.defineProperty(globalThis, "window", {
      value: { isSecureContext: true },
      configurable: true,
    });
    Object.defineProperty(globalThis, "location", {
      value: { hostname: "iamable.space" },
      configurable: true,
    });
    Object.defineProperty(globalThis, "PublicKeyCredential", {
      value: class {},
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: {
        credentials: {
          create: async (o: any) => {
            calls.push(o);
            return {
              rawId,
              getClientExtensionResults: () => ({
                prf: { enabled: supported },
              }),
            };
          },
          get: async (o: any) => {
            calls.push(o);
            return {
              rawId: mismatch ? new Uint8Array([4]).buffer : rawId,
              getClientExtensionResults: () => ({
                prf: { results: { first: secret.slice().buffer } },
              }),
            };
          },
        },
      },
      configurable: true,
    });
    const material = await createPasskeyMaterial(a);
    expect(material.secret).toEqual(secret);
    expect(calls).toHaveLength(2);
    expect(calls[0].publicKey.authenticatorSelection.userVerification).toBe(
      "required",
    );
    expect(calls[1].publicKey.userVerification).toBe("required");
    expect(
      new Uint8Array(calls[0].publicKey.extensions.prf.eval.first),
    ).toEqual(new Uint8Array(calls[1].publicKey.extensions.prf.eval.first));
    supported = false;
    calls.length = 0;
    await expect(createPasskeyMaterial(a)).rejects.toThrow("prf_unavailable");
    expect(calls).toHaveLength(1);
    await expect(
      getPasskeySecret({ ...material, rpId: "different.example" }),
    ).rejects.toThrow("passkey_unavailable");
    mismatch = true;
    await expect(getPasskeySecret(material)).rejects.toThrow("prf_unavailable");
  } finally {
    for (const [k, v] of original) {
      if (v) Object.defineProperty(globalThis, k, v);
      else Reflect.deleteProperty(globalThis, k);
    }
  }
});

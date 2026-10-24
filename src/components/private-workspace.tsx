"use client";
import { useText } from "./locale-provider";

import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { useEffect, useRef, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Dashboard } from "./dashboard";
import { Brand } from "./brand";
import { PrivacySettings } from "./privacy-settings";
import type { Locale } from "@/lib/locale";
import type { WorkspaceData } from "@/lib/types";
import type { PersonalData } from "@/lib/private-types";
import { applyPrivateMutation } from "@/lib/private-mutations";
import { reconcileJournal } from "@/lib/journal-reconcile";
import type { JournalWrite } from "@/lib/journal-autosave";
import {
  decryptVault,
  encryptVault,
  unlockVault,
  unlockVaultWithPasskey,
  type VaultEnvelope,
} from "@/lib/vault-crypto";
import { getPasskeySecret } from "@/lib/vault-passkeys";
export type LoadedWorkspace = {
  envelope: VaultEnvelope | null;
  standard: PersonalData | null;
  standardRevision: number | null;
  catalog: Pick<WorkspaceData, "recipes" | "ingredients">;
};
type Current = {
  key: CryptoKey | null;
  envelope: VaultEnvelope | null;
  data: PersonalData;
  revision: number;
};
export function PrivateWorkspace({
  locale,
  userId,
  admin,
}: {
  locale: Locale;
  userId: string;
  admin: boolean;
}) {
  const t = useText(locale);
  const [loaded, setLoaded] = useState<LoadedWorkspace | null>(null),
    [data, setData] = useState<PersonalData | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [secret, setSecret] = useState(""),
    [recovery, setRecovery] = useState(false);
  const [restore, setRestore] = useState<VaultEnvelope | null>(null);
  const journalSync = useRef<import("@/lib/journal-autosave").JournalSyncBridge>({});
  const state = useRef<Current | null>(null),
    queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let alive = true;
    void fetch("/api/vault", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<LoadedWorkspace>;
      })
      .then((v) => {
        if (!alive) return;
        setLoaded(v);
        if (!v.envelope && v.standard) {
          state.current = {
            key: null,
            envelope: null,
            data: v.standard,
            revision: v.standardRevision ?? 0,
          };
          setData(v.standard);
        }
      })
      .catch(() => {
        if (alive)
          setError(
            t(
              "Impossible d’ouvrir votre espace. Rechargez la page.",
              "Unable to open your space. Please reload.",
            ),
          );
      });
    return () => {
      alive = false;
      state.current = null;
    };
  }, []);
  async function upload(
    envelope: VaultEnvelope,
    expectedRevision: number,
    expectedStandardRevision?: number,
  ) {
    const r = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        envelope,
        expectedRevision,
        expectedStandardRevision,
      }),
    });
    if (!r.ok) throw Error(r.status === 409 ? "conflict" : "save");
    if ((await r.json()).revision !== envelope.revision) throw Error("save");
  }
  function describe(e: unknown) {
    return e instanceof Error && e.message === "conflict"
      ? t(
          "Votre espace a changé dans une autre page. Rechargez avant de réessayer; aucune donnée n’a été remplacée.",
          "Your space changed in another page. Reload before retrying; no data was replaced.",
        )
      : t(
          "L’opération n’a pas pu être confirmée. Vérifiez votre moyen de déverrouillage et votre connexion.",
          "The operation could not be confirmed. Check your unlocking method and connection.",
        );
  }
  function persist(type: string, value: object): Promise<PersonalData> {
    const operation = queue.current
      .catch(() => undefined)
      .then(async () => {
        let current = state.current;
        if (!current) throw Error("locked");
        const original = current;
        let mutation = value;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            let next: PersonalData;
            if (current.envelope && current.key) {
              next =
                type === "program"
                  ? { ...current.data, program: value as PersonalData["program"] }
                  : applyPrivateMutation(current.data, type, mutation, loaded?.catalog);
              const envelope = await encryptVault(
                current.key,
                current.envelope,
                next,
              );
              if (!state.current) throw Error("locked");
              await upload(envelope, current.revision);
              if (!state.current) throw Error("locked");
              state.current = {
                ...current,
                data: next,
                envelope,
                revision: envelope.revision,
              };
            } else {
              const response = await fetch("/api/personal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  expectedRevision: current.revision,
                  type,
                  value: mutation,
                }),
              });
              if (!response.ok)
                throw Error(response.status === 409 ? "conflict" : "save");
              const saved = await response.json();
              if (!state.current) throw Error("locked");
              next = saved.data;
              state.current = { ...current, data: next, revision: saved.revision };
            }
            setData(next);
            return next;
          } catch (error) {
            if (type !== "journal" || attempt !== 0 || !(error instanceof Error) || error.message !== "conflict") throw error;
            if (!state.current) throw Error("locked");
            const response = await fetch("/api/vault", { cache: "no-store" });
            if (!response.ok) throw Error("save");
            const fresh: LoadedWorkspace = await response.json();
            if (!state.current) throw Error("locked");
            // A protection change in another tab requires reopening the workspace.
            if (!!fresh.envelope !== !!original.envelope) throw Error("conflict");
            const remote = fresh.envelope && original.key
              ? await decryptVault<PersonalData>(original.key, fresh.envelope, userId)
              : fresh.standard;
            if (!state.current) throw Error("locked");
            if (!remote) throw Error("conflict");
            const write = value as JournalWrite;
            const resolution = reconcileJournal(
              original.data.journal.find(entry => entry.date === write.date),
              remote.journal.find(entry => entry.date === write.date),
              write,
            );
            current = { ...original, data: remote, envelope: fresh.envelope, revision: fresh.envelope?.revision ?? fresh.standardRevision ?? 0 };
            state.current = current;
            if (resolution === "acknowledged") {
              setData(remote);
              return remote;
            }
            mutation = resolution;
          }
        }
        throw Error("conflict");
      });
    queue.current = operation;
    return operation;
  }
  async function snapshot() {
    await journalSync.current.flush?.();
    await queue.current.catch(() => undefined);
    const current = state.current;
    if (!current) throw Error("locked");
    return { ...current };
  }
  async function protect(
    key: CryptoKey,
    envelope: VaultEnvelope,
    expected: Current,
  ) {
    await journalSync.current.flush?.();
    await queue.current.catch(() => undefined);
    if (
      state.current?.revision !== expected.revision ||
      state.current?.envelope !== expected.envelope
    )
      throw Error("conflict");
    const prepared = await decryptVault<PersonalData>(key, envelope, userId);
    const current = await encryptVault(
      key,
      { ...envelope, revision: expected.envelope ? expected.revision : 0 },
      prepared,
    );
    await upload(
      current,
      expected.envelope ? expected.revision : 0,
      expected.envelope ? undefined : expected.revision,
    );
    const response = await fetch("/api/vault", { cache: "no-store" });
    if (!response.ok) throw Error("readback");
    const saved: LoadedWorkspace = await response.json();
    if (!saved.envelope || saved.standard) throw Error("readback");
    const verified = await decryptVault<PersonalData>(
      key,
      saved.envelope,
      userId,
    );
    if (JSON.stringify(verified) !== JSON.stringify(prepared))
      throw Error("readback");
    state.current = {
      key,
      envelope: saved.envelope,
      data: verified,
      revision: saved.envelope.revision,
    };
    setLoaded(saved);
    setData(verified);
    setRestore(null);
    setSecret("");
  }
  async function open(usePasskey = false) {
    const envelope = restore || loaded?.envelope;
    if (!envelope) return;
    setBusy(true);
    setError("");
    try {
      const entry = envelope.passkeys?.find((item) => item.rpId === location.hostname);
      if (usePasskey && !entry) throw Error("passkey_unavailable");
      const key =
        usePasskey && entry
          ? await unlockVaultWithPasskey(
              envelope,
              userId,
              entry.id,
              await getPasskeySecret(entry),
            )
          : await unlockVault(envelope, userId, secret, recovery || !envelope.password);
      const value = await decryptVault<PersonalData>(key, envelope, userId);
      if (
        !Array.isArray(value.journal) ||
        !Array.isArray(value.weights) ||
        !value.program
      )
        throw Error("format");
      if (restore) {
        if (
          !window.confirm(
            t(
              "Restaurer cette sauvegarde? Elle remplacera vos données actuelles et activera la protection renforcée si nécessaire.",
              "Restore this backup? It will replace current data and enable enhanced protection if needed.",
            ),
          )
        )
          return;
        const expected = state.current || {
          key: null,
          envelope: loaded!.envelope,
          data: value,
          revision: loaded!.envelope?.revision ?? loaded!.standardRevision ?? 0,
        };
        // A locked encrypted workspace still has a known revision; its old key is not needed.
        state.current = expected;
        await protect(key, envelope, expected);
      } else {
        state.current = {
          key,
          envelope,
          data: value,
          revision: envelope.revision,
        };
        setData(value);
      }
      setSecret("");
      setRecovery(false);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }
  function selectRestore(value: VaultEnvelope) {
    setRestore(value);
    setRecovery(!value.password);
    setError("");
  }
  if (loaded && data && state.current && !restore) {
    const current = state.current;
    return (
      <Dashboard
        locale={locale}
        mode="private"
        initialData={{ ...data, ...loaded.catalog }}
        privateActions={{
          admin,
          userId,
          journalKey: current.key,
          journalSync: journalSync.current,
          progress: data.program,
          protection: current.envelope ? "enhanced" : "standard",
          mutate: async (type, value) => ({
            ...(await persist(type, value)),
            ...loaded.catalog,
          }),
          saveProgress: async (p) => {
            await persist("program", p);
          },
          lock: () => window.location.reload(),
          backup: () => {
            if (state.current?.envelope)
              download(
                JSON.stringify(state.current.envelope, null, 2),
                "tredmeal-coffre-chiffre.json",
                "application/json",
              );
          },
          privacyPanel: (displayLocale) => (
            <PrivacySettings
              locale={displayLocale}
              enhanced={!!current.envelope}
              migrate={async () => {
                const expected = await snapshot();
                if (!expected.envelope) return;
                const response = await fetch("/api/vault/migrate", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ expectedRevision: expected.revision, acknowledged: true, personal: expected.data }) });
                if (!response.ok) throw Error("migration");
                const readback = await fetch("/api/vault", {cache:"no-store"});
                if (!readback.ok) throw Error("readback");
                const saved: LoadedWorkspace = await readback.json();
                const canonical = (value: unknown): string => JSON.stringify(value, function(_key, item) { return item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))) : item; });
                if (saved.envelope || !saved.standard || canonical(saved.standard) !== canonical(expected.data)) throw Error("readback");
                state.current = {key:null,envelope:null,data:saved.standard,revision:saved.standardRevision || 0};
                setLoaded(saved); setData(saved.standard); setRestore(null); setSecret("");
              }}
              backup={() => {
                if (state.current?.envelope)
                  download(
                    JSON.stringify(state.current.envelope, null, 2),
                    "tredmeal-coffre-chiffre.json",
                    "application/json",
                  );
              }}
            />
          ),
        }}
      />
    );
  }
  const envelope = restore || loaded?.envelope;
  const localPasskey = typeof window !== "undefined" &&
    envelope?.passkeys?.some((item) => item.rpId === window.location.hostname);
  const legacyPasskey = typeof window !== "undefined" &&
    window.location.hostname === "tredmeal.com" &&
    envelope?.passkeys?.some((item) => item.rpId === "iamable.space");
  return (
    <main className="vault-screen">
      <a href={`/${locale}`}>
        <Brand />
      </a>
      <section className="vault-card">
        <div className="vault-emblem">
          <LockKeyhole size={28} />
        </div>
        <span className="eyebrow">
          {t("VOTRE ESPACE, POUR VOUS", "YOUR SPACE, FOR YOU")}
        </span>
        <h1>
          {envelope
            ? t("Déverrouiller mon espace.", "Unlock my space.")
            : t("Bienvenue chez vous.", "Welcome to your space.")}
        </h1>
        {!loaded ? (
          <p role="status">
            {t("Ouverture de votre espace…", "Opening your space…")}
          </p>
        ) : envelope ? (
          <>
            <p>
              {restore
                ? t(
                    "Sauvegarde sélectionnée. Déverrouillez-la pour confirmer sa restauration.",
                    "Backup selected. Unlock it to confirm restoration.",
                  )
                : t(
                    "Vous avez activé la protection renforcée. Déverrouillez vos données sur cet appareil.",
                    "You enabled enhanced protection. Unlock your data on this device.",
                  )}
            </p>
            {legacyPasskey && !localPasskey && (
              <p className="notice">
                {t("Votre clé d’accès est liée à l’ancienne adresse. Vous pouvez l’utiliser sur iamable.space, ou ouvrir cet espace ici avec votre code de récupération.", "Your passkey belongs to the previous address. Use it on iamable.space, or unlock here with your recovery code.")}
                {" "}<a href={`https://iamable.space/${locale}/dashboard`}>{t("Ouvrir avec mon ancienne clé", "Use my existing passkey")}</a>
              </p>
            )}
            {localPasskey && (
              <>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void open(true)}
                >
                  {t(
                    "Déverrouiller avec ma clé d’accès",
                    "Unlock with my passkey",
                  )}
                </button>
                <p className="small muted">
                  {t(
                    "Touch ID, Face ID ou code de l’appareil, selon votre configuration.",
                    "Touch ID, Face ID or device PIN, depending on your setup.",
                  )}
                </p>
              </>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void open();
              }}
            >
              <label>
                {recovery || !envelope.password
                  ? t("Code de récupération", "Recovery code")
                  : t("Phrase secrète", "Passphrase")}
                <input
                  type="password"
                  autoComplete={recovery || !envelope.password ? "off" : "current-password"}
                  required
                  value={secret}
                  disabled={busy}
                  spellCheck={false}
                  onChange={(e) => {
                    setSecret(e.target.value);
                    if (!envelope.password) setRecovery(true);
                  }}
                />
              </label>
              <button className="secondary" disabled={busy}>
                {busy
                  ? t("Un instant…", "One moment…")
                  : t("Déverrouiller", "Unlock")}
              </button>
            </form>
            {envelope.password && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setRecovery(!recovery);
                  setSecret("");
                }}
              >
                {recovery
                  ? t("Utiliser ma phrase secrète", "Use my passphrase")
                  : t(
                      "Utiliser mon code de récupération",
                      "Use my recovery code",
                    )}
              </button>
            )}
            {restore && (
              <button
                className="text-button"
                onClick={() => {
                  setRestore(null);
                  setSecret("");
                }}
              >
                {t("Annuler la restauration", "Cancel restore")}
              </button>
            )}
            <RestoreFile
              locale={locale}
              userId={userId}
              onSelect={selectRestore}
            />
          </>
        ) : null}
        {error && <p role="alert">{t(error)}</p>}
        <form method="post" action="/auth/logout">
          <input type="hidden" name="locale" value={locale} />
          <button className="text-button">
            {t("Me déconnecter", "Sign out")}
          </button>
        </form>
      </section>
    </main>
  );
}
export function RestoreFile({
  locale,
  userId,
  onSelect,
}: {
  locale: Locale;
  userId: string;
  onSelect: (e: VaultEnvelope) => void;
}) {
  const [error, setError] = useState("");
  const t = useText(locale);
  return (
    <details>
      <summary>
        {t("Restaurer une sauvegarde chiffrée", "Restore an encrypted backup")}
      </summary>
      <label>
        {t("Fichier de sauvegarde", "Backup file")}
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            try {
              const file = e.target.files?.[0];
              if (!file || file.size > 12000000) throw Error();
              const v = JSON.parse(await file.text());
              if (v.version !== 1 || v.ownerId !== userId) throw Error();
              setError("");
              onSelect(v);
            } catch {
              setError(
                t(
                  "Ce fichier ne correspond pas à votre espace.",
                  "This file does not belong to your space.",
                ),
              );
            }
          }}
        />
      </label>
      {error && <p role="alert">{t(error)}</p>}
    </details>
  );
}
export function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

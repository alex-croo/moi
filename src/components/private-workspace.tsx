"use client";
import { useEffect, useRef, useState } from "react";
import { LockKeyhole, ShieldCheck, KeyRound } from "lucide-react";
import { Dashboard } from "./dashboard";
import { Brand } from "./brand";
import type { Locale } from "@/lib/locale";
import type { WorkspaceData } from "@/lib/types";
import type { PersonalData, ProgramProgress } from "@/lib/private-types";
import { applyPrivateMutation } from "@/lib/private-mutations";
import {
  createVault,
  decryptVault,
  encryptVault,
  unlockVault,
  changeVaultPassphrase,
  type VaultEnvelope,
} from "@/lib/vault-crypto";
type Loaded = {
  envelope: VaultEnvelope | null;
  legacy: Omit<WorkspaceData, "recipes" | "ingredients"> | null;
  catalog: Pick<WorkspaceData, "recipes" | "ingredients">;
};
const message = (locale: Locale, fr: string, en: string) =>
  locale === "fr" ? fr : en;
export function PrivateWorkspace({
  locale,
  userId,
  admin,
}: {
  locale: Locale;
  userId: string;
  admin: boolean;
}) {
  const t = (fr: string, en: string) => message(locale, fr, en);
  const [loaded, setLoaded] = useState<Loaded | null>(null),
    [data, setData] = useState<PersonalData | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [recovery, setRecovery] = useState(false),
    [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState<Awaited<
      ReturnType<typeof createVault<PersonalData>>
    > | null>(null),
    [recoveryCheck, setRecoveryCheck] = useState("");
  const [restore, setRestore] = useState<VaultEnvelope | null>(null);
  const state = useRef<{
    key: CryptoKey;
    envelope: VaultEnvelope;
    data: PersonalData;
  } | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void fetch("/api/vault", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error("load");
        return r.json();
      })
      .then((v) => {
        if (mounted.current) setLoaded(v);
      })
      .catch(() =>
        setError(
          t(
            "Impossible d’ouvrir votre espace. Rechargez la page.",
            "Unable to open your space. Please reload.",
          ),
        ),
      );
    return () => {
      mounted.current = false;
      state.current = null;
    };
  }, []); // Never cache plaintext in persistent browser storage.
  async function upload(envelope: VaultEnvelope, expectedRevision: number) {
    const response = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelope, expectedRevision }),
    });
    if (!response.ok)
      throw Error(response.status === 409 ? "conflict" : "save");
    const saved = await response.json();
    if (saved.revision !== envelope.revision) throw Error("save");
  }
  async function enter(event: React.FormEvent) {
    event.preventDefault();
    if (!loaded) return;
    setBusy(true);
    setError("");
    try {
      const envelope = restore || loaded.envelope;
      if (envelope) {
        const key = await unlockVault(envelope, userId, password, recovery);
        const value = await decryptVault<PersonalData>(key, envelope, userId);
        if (
          !Array.isArray(value.journal) ||
          !Array.isArray(value.weights) ||
          !value.program
        )
          throw Error("format");
        let current = envelope;
        if (recovery) {
          if (newPassword !== confirm) throw Error("confirmation");
          current = await changeVaultPassphrase(
            current,
            userId,
            password,
            newPassword,
          );
        }
        if (restore || recovery) {
          if (
            restore &&
            !window.confirm(
              t(
                "Remplacer les données de votre coffre par cette sauvegarde? Les changements plus récents seront perdus.",
                "Replace your vault with this backup? More recent changes will be lost.",
              ),
            )
          )
            return;
          current = await encryptVault(
            key,
            { ...current, revision: loaded.envelope?.revision || 0 },
            value,
          );
          await upload(current, loaded.envelope?.revision || 0);
        }
        state.current = { key, envelope: current, data: value };
        setData(value);
        setPassword("");
        setNewPassword("");
        setConfirm("");
        setRestore(null);
      } else {
        if (password !== confirm) throw Error("confirmation");
        if (!loaded.legacy) throw Error("migration");
        const value: PersonalData = {
          ...loaded.legacy,
          program: { completed: {}, reflections: {} },
        };
        setPending(await createVault(userId, password, value));
        setPassword("");
        setConfirm("");
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message === "conflict"
          ? t(
              "Une autre page a modifié ce coffre. Rechargez avant de réessayer.",
              "Another page changed this vault. Reload before retrying.",
            )
          : t(
              "L’ouverture n’a pas pu être confirmée. Vérifiez votre phrase secrète, votre code et la confirmation. En cas de connexion interrompue, rechargez avant de réessayer.",
              "Opening could not be confirmed. Check your passphrase, recovery code and confirmation. If the connection was interrupted, reload before retrying.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function finishSetup() {
    if (
      !pending ||
      !loaded ||
      recoveryCheck.trim().toLowerCase() !==
        pending.recoveryCode.split("-").at(-1)
    )
      return;
    setBusy(true);
    setError("");
    try {
      const value = await decryptVault<PersonalData>(
        pending.key,
        pending.envelope,
        userId,
      );
      await upload(pending.envelope, 0);
      // Readback confirms the actual server record, not only a successful POST.
      const response = await fetch("/api/vault", { cache: "no-store" });
      if (!response.ok) throw Error("readback");
      const saved: Loaded = await response.json();
      if (!saved.envelope) throw Error("readback");
      const verified = await decryptVault<PersonalData>(
        pending.key,
        saved.envelope,
        userId,
      );
      if (JSON.stringify(value) !== JSON.stringify(verified))
        throw Error("readback");
      state.current = {
        key: pending.key,
        envelope: saved.envelope,
        data: verified,
      };
      setData(verified);
      setLoaded({ ...saved, legacy: null });
      setPending(null);
      setRecoveryCheck("");
    } catch {
      setError(
        t(
          "L’enregistrement n’a pas pu être confirmé. Gardez votre code de récupération et rechargez pour ouvrir votre coffre.",
          "Saving could not be confirmed. Keep your recovery code and reload to open your vault.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function persist(
    update: (current: PersonalData) => PersonalData,
  ): Promise<PersonalData> {
    const operation = queue.current
      .catch(() => undefined)
      .then(async () => {
        const current = state.current;
        if (!current) throw Error("locked");
        const next = update(current.data);
        const envelope = await encryptVault(
          current.key,
          current.envelope,
          next,
        );
        await upload(envelope, current.envelope.revision);
        state.current = { ...current, data: next, envelope };
        setData(next);
        return next;
      });
    queue.current = operation;
    return operation;
  }
  function backup() {
    const current = state.current;
    if (!current) return;
    download(
      JSON.stringify(current.envelope, null, 2),
      "iamable-coffre-chiffre.json",
      "application/json",
    );
  }
  if (data && state.current && loaded)
    return (
      <Dashboard
        locale={locale}
        mode="private"
        initialData={{ ...data, ...loaded.catalog }}
        privateActions={{
          admin,
          userId,
          progress: data.program,
          mutate: async (type, value) => ({
            ...(await persist((current) =>
              applyPrivateMutation(current, type, value),
            )),
            ...loaded.catalog,
          }),
          saveProgress: async (program: ProgramProgress) => {
            await persist((current) => ({ ...current, program }));
          },
          lock: () => window.location.reload(),
          backup,
        }}
      />
    );
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
          {pending
            ? t("Votre clé de secours.", "Your recovery key.")
            : loaded?.envelope
              ? t("Ouvrir mon coffre.", "Unlock my vault.")
              : t("Protéger mon espace.", "Protect my space.")}
        </h1>
        {!loaded ? (
          <p role="status">
            {t("Ouverture de votre espace…", "Opening your space…")}
          </p>
        ) : pending ? (
          <>
            <p>
              {t(
                "Conservez ce code dans votre gestionnaire de mots de passe ou sur papier, dans un endroit sûr. Il peut ouvrir votre coffre sans votre phrase secrète.",
                "Save this code in your password manager or on paper in a safe place. It can unlock your vault without your passphrase.",
              )}
            </p>
            <code className="recovery-code">{pending.recoveryCode}</code>
            <button
              className="secondary"
              onClick={() =>
                download(
                  `I am able — ${userId}\n${pending.recoveryCode}\n`,
                  "iamable-code-de-recuperation.txt",
                  "text/plain",
                )
              }
            >
              {t("Télécharger mon code", "Download my code")}
            </button>
            <p>
              {t(
                "Sans la phrase secrète ni ce code, personne — même l’administration — ne pourra récupérer votre journal.",
                "Without the passphrase or this code, nobody — including the administrator — can recover your journal.",
              )}
            </p>
            <label>
              {t(
                "Recopiez le dernier groupe de 8 caractères de votre copie",
                "Enter the last 8-character group from your saved copy",
              )}
              <input
                autoComplete="off"
                spellCheck={false}
                value={recoveryCheck}
                onChange={(e) => setRecoveryCheck(e.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={
                busy ||
                recoveryCheck.trim().toLowerCase() !==
                  pending.recoveryCode.split("-").at(-1)
              }
              onClick={() => void finishSetup()}
            >
              {busy
                ? t("Protection en cours…", "Protecting…")
                : t(
                    "J’ai conservé mon code · Protéger mes données",
                    "I saved my code · Protect my data",
                  )}
            </button>
          </>
        ) : (
          <>
            <p>
              {loaded.envelope
                ? t(
                    "Votre connexion Google vous identifie. Votre phrase secrète déchiffre vos données uniquement sur cet appareil.",
                    "Google signs you in. Your passphrase decrypts your data only on this device.",
                  )
                : t(
                    "Votre journal, vos mesures, vos menus et votre progression seront chiffrés sur cet appareil avant d’être enregistrés. Choisissez une longue phrase que vous n’utilisez nulle part ailleurs.",
                    "Your journal, measurements, menus and progress will be encrypted on this device before they are saved. Choose a long passphrase you do not use elsewhere.",
                  )}
            </p>
            {!loaded.envelope && (
              <p className="privacy-note">
                {t(
                  "Vos données existantes seront conservées dans le coffre. Les anciennes copies de sauvegarde nécessitent un traitement séparé; elles ne deviennent pas chiffrées automatiquement.",
                  "Your existing data will be kept in the vault. Older backups need separate handling; they do not become encrypted automatically.",
                )}
              </p>
            )}
            {restore && (
              <p role="status">
                {t(
                  "Sauvegarde sélectionnée. Déverrouillez-la pour confirmer sa restauration.",
                  "Backup selected. Unlock it to confirm restoration.",
                )}
              </p>
            )}
            <form onSubmit={enter}>
              <label>
                {recovery
                  ? t("Code de récupération", "Recovery code")
                  : t("Phrase secrète", "Passphrase")}
                <input
                  type="password"
                  autoComplete={
                    loaded.envelope ? "current-password" : "new-password"
                  }
                  spellCheck={false}
                  required
                  minLength={recovery ? 64 : loaded.envelope ? 1 : 16}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              {recovery && (
                <label>
                  {t(
                    "Nouvelle phrase secrète · 16 caractères minimum",
                    "New passphrase · at least 16 characters",
                  )}
                  <input
                    type="password"
                    required
                    minLength={16}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </label>
              )}
              {((!loaded.envelope && !restore) || recovery) && (
                <label>
                  {t("Confirmer la phrase secrète", "Confirm passphrase")}
                  <input
                    type="password"
                    required
                    minLength={16}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? t("Un instant…", "One moment…")
                  : loaded.envelope || restore
                    ? t("Ouvrir mon espace", "Open my space")
                    : t("Créer mon coffre", "Create my vault")}
              </button>
            </form>
            {(loaded.envelope || restore) && (
              <button
                className="text-button"
                onClick={() => {
                  setRecovery(!recovery);
                  setPassword("");
                  setConfirm("");
                  setNewPassword("");
                }}
              >
                <KeyRound size={16} />
                {recovery
                  ? t("Utiliser ma phrase secrète", "Use my passphrase")
                  : t(
                      "Utiliser mon code de récupération",
                      "Use my recovery code",
                    )}
              </button>
            )}
            <details>
              <summary>
                {t(
                  "Restaurer une sauvegarde chiffrée",
                  "Restore an encrypted backup",
                )}
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
                      const value = JSON.parse(await file.text());
                      if (value.version !== 1 || value.ownerId !== userId)
                        throw Error();
                      setRestore(value);
                      setError("");
                    } catch {
                      setError(
                        t(
                          "Ce fichier ne correspond pas à votre coffre.",
                          "This file does not belong to your vault.",
                        ),
                      );
                    }
                  }}
                />
              </label>
              {restore && (
                <button
                  className="text-button"
                  onClick={() => setRestore(null)}
                >
                  {t("Annuler la restauration", "Cancel restore")}
                </button>
              )}
            </details>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <p className="privacy-note">
          <ShieldCheck size={16} />
          {t(
            "Aucune copie de votre clé n’est confiée à l’administration. Les dates de connexion et le volume du coffre restent des informations techniques visibles.",
            "The administrator does not hold a copy of your key. Sign-in times and vault size remain visible technical information.",
          )}
        </p>
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
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

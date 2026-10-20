"use client";
import { useEffect, useState } from "react";
import { Fingerprint, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/locale";
import type { PersonalData } from "@/lib/private-types";
import { createVault, type VaultEnvelope } from "@/lib/vault-crypto";
import { createPasskeyMaterial, passkeyAvailable } from "@/lib/vault-passkeys";
import { download, RestoreFile } from "./private-workspace";
type Snapshot = {
  key: CryptoKey | null;
  envelope: VaultEnvelope | null;
  data: PersonalData;
  revision: number;
};
export function PrivacySettings({
  locale,
  userId,
  enhanced,
  passkey,
  snapshot,
  protect,
  backup,
  onRestore,
}: {
  locale: Locale;
  userId: string;
  enhanced: boolean;
  passkey: boolean;
  snapshot: () => Promise<Snapshot>;
  protect: (
    key: CryptoKey,
    envelope: VaultEnvelope,
    expected: Snapshot,
  ) => Promise<void>;
  backup: () => void;
  onRestore: (e: VaultEnvelope) => void;
}) {
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const [available, setAvailable] = useState(false),
    [choosing, setChoosing] = useState(false),
    [manual, setManual] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [phrase, setPhrase] = useState(""),
    [confirm, setConfirm] = useState(""),
    [saved, setSaved] = useState(false),
    [ack, setAck] = useState(false);
  const [pending, setPending] = useState<{
    created: Awaited<ReturnType<typeof createVault<PersonalData>>>;
    expected: Snapshot;
  } | null>(null);
  useEffect(() => setAvailable(passkeyAvailable()), []);
  async function prepare(withPasskey: boolean) {
    setBusy(true);
    setError("");
    try {
      if (!withPasskey && (phrase !== confirm || phrase.length < 16))
        throw Error("phrase");
      const expected = await snapshot();
      const material = withPasskey
        ? await createPasskeyMaterial(userId)
        : undefined;
      const created = await createVault(
        userId,
        withPasskey ? null : phrase,
        expected.data,
        material,
      );
      setPending({ created, expected });
      setPhrase("");
      setConfirm("");
      setSaved(false);
      setAck(false);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "phrase"
          ? t(
              "Entrez deux fois la même phrase, d’au moins 16 caractères.",
              "Enter the same passphrase twice, with at least 16 characters.",
            )
          : t(
              "La clé d’accès n’a pas pu être préparée ou votre appareil ne permet pas le chiffrement avec cette clé. Vos données n’ont pas changé. Réessayez ou choisissez une phrase secrète.",
              "The passkey could not be prepared, or your device does not support encryption with this key. Your data has not changed. Retry or choose a passphrase.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!pending || !saved || !ack) return;
    setBusy(true);
    setError("");
    try {
      await protect(
        pending.created.key,
        pending.created.envelope,
        pending.expected,
      );
      setPending(null);
      setChoosing(false);
      setStatus(
        t(
          "Protection renforcée activée. Vos données existantes sont maintenant chiffrées.",
          "Enhanced protection is on. Your existing data is now encrypted.",
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error && e.message === "conflict"
          ? t(
              "Vos données ont changé pendant l’activation. Annulez et recommencez à partir des données à jour.",
              "Your data changed during setup. Cancel and start again with current data.",
            )
          : t(
              "L’enregistrement n’a pas pu être confirmé. Gardez votre code et rechargez avant de réessayer.",
              "Saving could not be confirmed. Keep your code and reload before retrying.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card privacy-settings" aria-labelledby="privacy-title">
      <div className="privacy-heading">
        <div>
          <span className="eyebrow">{t("CONFIDENTIALITÉ", "PRIVACY")}</span>
          <h2 id="privacy-title">
            {t("Un espace à votre mesure.", "Privacy that fits you.")}
          </h2>
        </div>
        <span className={`privacy-badge ${enhanced ? "enhanced" : ""}`}>
          <ShieldCheck size={16} />
          {enhanced
            ? t("Protection renforcée", "Enhanced protection")
            : t("Protection standard", "Standard protection")}
        </span>
      </div>
      <p>
        {enhanced
          ? t(
              "Vos données sont chiffrées avant leur enregistrement. L’administration ne possède pas la clé pour les lire.",
              "Your data is encrypted before saving. The administrator does not hold the key to read it.",
            )
          : t(
              "Vous entrez simplement avec Google. Vos données sont séparées de celles des autres membres. En mode standard, les opérateurs techniques peuvent y accéder dans l’infrastructure.",
              "Simply sign in with Google. Your data is separate from other members’ data. In standard mode, infrastructure operators can technically access it.",
            )}
      </p>
      {!choosing && !pending ? (
        <>
          <div className="action-row">
            <button
              className="primary"
              onClick={() => {
                setChoosing(true);
                setError("");
                setStatus("");
              }}
            >
              <Fingerprint size={18} />
              {enhanced
                ? t(
                    "Configurer un moyen de déverrouillage",
                    "Set up an unlocking method",
                  )
                : t(
                    "Activer la protection renforcée",
                    "Enable enhanced protection",
                  )}
            </button>
            {enhanced && (
              <>
                <button className="secondary" onClick={backup}>
                  {t("Sauvegarde chiffrée", "Encrypted backup")}
                </button>
                <button
                  className="text-button"
                  onClick={() => window.location.reload()}
                >
                  {t("Verrouiller mon espace", "Lock my space")}
                </button>
              </>
            )}
          </div>
          <p className="small muted">
            {enhanced
              ? passkey
                ? t(
                    "Déverrouillage par clé d’accès ou code de récupération.",
                    "Unlock with a passkey or recovery code.",
                  )
                : t(
                    "Déverrouillage par phrase secrète ou code de récupération.",
                    "Unlock with a passphrase or recovery code.",
                  )
              : t(
                  "Une option personnelle. Votre journal, vos mesures, vos menus et votre progression existants seront aussi protégés.",
                  "A personal choice. Your existing journal, measurements, meals and progress will also be protected.",
                )}
          </p>
          <RestoreFile locale={locale} userId={userId} onSelect={onRestore} />
        </>
      ) : pending ? (
        <div className="privacy-setup">
          <h3>{t("Gardez une clé de secours.", "Keep a recovery key.")}</h3>
          <p>
            {t(
              "Elle permet de retrouver vos données si vous perdez votre moyen de déverrouillage. L’administration ne peut pas la remplacer.",
              "It lets you recover your data if you lose your unlocking method. The administrator cannot replace it.",
            )}
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              download(
                `I am able — ${userId}\n${pending.created.recoveryCode}\n`,
                "iamable-code-de-recuperation.txt",
                "text/plain",
              );
              setSaved(true);
            }}
          >
            {t("Enregistrer ma clé de secours", "Save my recovery key")}
          </button>
          <details>
            <summary>
              {t(
                "Afficher le code pour le conserver autrement",
                "Show the code to save it another way",
              )}
            </summary>
            <code className="recovery-code">
              {pending.created.recoveryCode}
            </code>
            <button className="text-button" onClick={() => setSaved(true)}>
              {t(
                "J’ai conservé ce code ailleurs",
                "I saved this code elsewhere",
              )}
            </button>
          </details>
          <label className="privacy-consent">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            <span>
              {t(
                "J’ai conservé ma clé dans un endroit sûr. Sans mon moyen de déverrouillage ni cette clé, mes données seront irrécupérables.",
                "I saved my key somewhere safe. Without my unlocking method or this key, my data cannot be recovered.",
              )}
            </span>
          </label>
          <button
            className="primary"
            disabled={busy || !saved || !ack}
            onClick={() => void finish()}
          >
            {busy
              ? t("Chiffrement en cours…", "Encrypting…")
              : t(
                  "Activer et chiffrer mes données",
                  "Enable and encrypt my data",
                )}
          </button>
        </div>
      ) : (
        <div className="privacy-setup">
          <h3>
            {t("Choisissez comment déverrouiller.", "Choose how to unlock.")}
          </h3>
          <p>
            {t(
              "L’activation protège aussi tout ce que vous avez déjà enregistré. Les anciennes sauvegardes restent à traiter séparément.",
              "Activation also protects everything you have already saved. Older backups need separate handling.",
            )}
          </p>
          {enhanced && (
            <p className="privacy-note">
              {t(
                "Ce changement remplacera votre moyen de déverrouillage et créera une nouvelle clé de secours.",
                "This change replaces your unlocking method and creates a new recovery key.",
              )}
            </p>
          )}
          {available && (
            <>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void prepare(true)}
              >
                <Fingerprint size={18} />
                {t("Utiliser une clé d’accès", "Use a passkey")}
              </button>
              <p className="small muted">
                {t(
                  "Touch ID, Face ID ou code de l’appareil, si votre navigateur et votre gestionnaire de clés le permettent. Deux confirmations peuvent être demandées pour vérifier la clé.",
                  "Touch ID, Face ID or device PIN, if supported by your browser and credential manager. Two confirmations may be requested to verify the key.",
                )}
              </p>
            </>
          )}
          {!available && (
            <p>
              {t(
                "Les clés d’accès ne sont pas disponibles dans ce navigateur. Vous pouvez utiliser une phrase secrète.",
                "Passkeys are not available in this browser. You can use a passphrase.",
              )}
            </p>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setManual(!manual)}
          >
            {t("Utiliser une phrase secrète", "Use a passphrase")}
          </button>
          {manual && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void prepare(false);
              }}
            >
              <label>
                {t(
                  "Phrase secrète · 16 caractères minimum",
                  "Passphrase · at least 16 characters",
                )}
                <input
                  type="password"
                  required
                  minLength={16}
                  autoComplete="new-password"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                {t("Confirmer la phrase", "Confirm passphrase")}
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={busy}
                />
              </label>
              <button className="secondary" disabled={busy}>
                {t("Continuer", "Continue")}
              </button>
            </form>
          )}
        </div>
      )}
      {(choosing || pending) && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setChoosing(false);
            setPending(null);
            setPhrase("");
            setConfirm("");
            setError("");
          }}
        >
          {t("Annuler", "Cancel")}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      <a href={`/${locale}/privacy`} className="text-button">
        {t(
          "Comprendre les protections et leurs limites",
          "Understand protections and their limits",
        )}
      </a>
    </section>
  );
}

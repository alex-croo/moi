"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, UserPlus, Eye } from "lucide-react";
import type { Locale } from "@/lib/locale";
import { LearningAdmin } from "./learning-admin";
type AdminData = {
  members: {
    id: string;
    email: string;
    role: string;
    active: boolean;
    protected: boolean;
  }[];
  invitations: {
    id: string;
    email: string;
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
  }[];
};
export function PlatformAdmin({ locale }: { locale: Locale }) {
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const [data, setData] = useState<AdminData | null>(null),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [preview, setPreview] = useState(false);
  async function run(action: string, target = "") {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const r = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, target }),
      });
      if (!r.ok) throw Error();
      setData(await r.json());
      if (action === "invite") {
        setEmail("");
        setStatus(
          t(
            "Invitation prête pour 7 jours. Transmettez le lien de connexion à cette personne; elle devra utiliser cette adresse Google. Aucun courriel n’a été envoyé.",
            "Invitation ready for 7 days. Share the sign-in link; this person must use that Google address. No email has been sent.",
          ),
        );
      }
    } catch {
      setError(
        t(
          "L’opération n’a pas abouti. Vérifiez l’adresse et l’accès existant, puis réessayez.",
          "The operation did not complete. Check the address and existing access, then retry.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void run("list");
  }, []);
  if (preview)
    return (
      <>
        <button className="text-button" onClick={() => setPreview(false)}>
          {t("← Retour à l’administration", "← Back to administration")}
        </button>
        <LearningAdmin/>
        <p role="status">{status}</p>
      </>
    );
  return (
    <section className="community-page">
      <div className="page-heading">
        <span className="eyebrow">
          {t("PRENDRE SOIN DE L’ESPACE", "CARE FOR THIS SPACE")}
        </span>
        <h1>{t("Administration.", "Administration.")}</h1>
        <p>
          {t(
            "Les accès et le contenu commun, avec une frontière claire autour de la vie privée.",
            "Access and shared content, with a clear boundary around privacy.",
          )}
        </p>
      </div>
      <aside className="privacy-note">
        <ShieldCheck size={20} />
        <p>
          {t(
            "Vous voyez les comptes, leur état et l’activation du coffre. Le journal, le poids, les repas et la progression personnelle ne sont pas accessibles ici. L’aperçu du programme n’utilise aucune donnée d’usager.",
            "You see accounts, their status and vault activation. Journals, weight, meals and personal progress are not available here. Program preview uses no user data.",
          )}
        </p>
      </aside>
      <div className="community-grid">
        <section className="card">
          <h2>
            <UserPlus size={21} />
            {t("Inviter une personne", "Invite someone")}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("invite", email);
            }}
          >
            <label>
              {t("Adresse du compte Google", "Google account email")}
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@exemple.com"
              />
            </label>
            <button className="primary" disabled={busy}>
              {t("Préparer l’invitation", "Prepare invitation")}
            </button>
          </form>
          <p className="small muted">
            {t(
              "L’invitation donne accès à la plateforme. La personne choisit ensuite les cercles qu’elle souhaite rejoindre.",
              "The invitation grants platform access. The person then chooses which circles to join.",
            )}
          </p>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${location.origin}/${locale}`,
                );
                setStatus(
                  t("Lien de connexion copié.", "Sign-in link copied."),
                );
              } catch {
                setStatus(`${location.origin}/${locale}`);
              }
            }}
          >
            {t("Copier le lien de connexion", "Copy sign-in link")}
          </button>
        </section>
        <section className="card">
          <h2>
            <Eye size={21} />
            {t("Centre documentaire", "Content library")}
          </h2>
          <p>
            {t(
              "150 fiches de départ réparties en 15 modules. Révisez les sources, enrichissez le parcours et publiez les lectures approuvées. Les journaux restent séparés.",
              "150 initial documents in 15 modules. Review sources, extend the journey and publish approved readings. Journals remain separate.",
            )}
          </p>
          <button className="secondary" onClick={() => setPreview(true)}>
            {t("Ouvrir le centre documentaire", "Open the content library")}
          </button>
        </section>
      </div>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      <section className="card">
        <h2>{t("Les comptes", "Accounts")}</h2>
        {!data ? (
          <p>{t("Chargement…", "Loading…")}</p>
        ) : (
          data.members.map((m) => (
            <div className="member-row" key={m.id}>
              <div>
                <strong>{m.email}</strong>
                <small>
                  {m.role === "admin"
                    ? t("Administration", "Admin")
                    : t("Participant", "Participant")}{" "}
                  ·{" "}
                  {m.active
                    ? t("Accès actif", "Active access")
                    : t("Accès suspendu", "Suspended access")}{" "}
                  ·{" "}
                  {m.protected
                    ? t("Coffre activé", "Vault active")
                    : t("Coffre à configurer", "Vault pending")}
                </small>
              </div>
              {m.role !== "admin" && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        m.active
                          ? t(
                              "Suspendre cet accès? Les données seront conservées.",
                              "Suspend access? Data will be preserved.",
                            )
                          : t("Rétablir cet accès?", "Restore access?"),
                      )
                    )
                      void run(m.active ? "suspend" : "restore", m.id);
                  }}
                >
                  {m.active
                    ? t("Suspendre", "Suspend")
                    : t("Rétablir", "Restore")}
                </button>
              )}
            </div>
          ))
        )}
      </section>
      <section className="card">
        <h2>{t("Les invitations", "Invitations")}</h2>
        {data?.invitations.length === 0 && (
          <p>{t("Aucune invitation pour le moment.", "No invitations yet.")}</p>
        )}
        {data?.invitations.map((i) => (
          <div className="member-row" key={i.id}>
            <div>
              <strong>{i.email}</strong>
              <small>
                {i.accepted_at
                  ? t("Acceptée", "Accepted")
                  : i.revoked_at
                    ? t("Annulée", "Cancelled")
                    : new Date(i.expires_at) < new Date()
                      ? t("Expirée", "Expired")
                      : `${t("Valide jusqu’au", "Valid until")} ${new Date(i.expires_at).toLocaleDateString(locale)}`}
              </small>
            </div>
            {!i.accepted_at && !i.revoked_at && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void run("cancel", i.id)}
              >
                {t("Annuler", "Cancel")}
              </button>
            )}
          </div>
        ))}
      </section>
    </section>
  );
}

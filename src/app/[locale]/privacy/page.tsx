import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
export default async function Privacy({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "fr" && locale !== "en") notFound();
  const t = (fr: string, en: string) => (locale === "fr" ? fr : en);
  const sections = [
    [t("Votre espace personnel", "Your personal space"), t("Votre compte Google ouvre un espace isolé des autres usagers. Le centre documentaire et l’administration ne donnent pas accès aux journaux. Les données sont protégées en transit et dans l’hébergement; les opérateurs techniques peuvent toutefois y accéder. Le journal accompagné n’est pas chiffré de bout en bout.", "Google sign-in opens a space isolated from other users. Editorial and admin tools do not expose journals. Data is protected in transit and at rest; technical operators may access it. The guided journal is not end-to-end encrypted.")],
    [t("La personnalisation reste votre choix", "Personalization is your choice"), t("La personnalisation est désactivée par défaut. Avec votre accord, des extraits récents de votre journal, vos notes de lecture et vos repères confirmés peuvent être envoyés à Fireworks pour Ember-1. Aucun vrai journal n’est envoyé avant la vérification de la politique de zéro rétention pour le compte et le modèle utilisés. Les métadonnées techniques, le cache temporaire et les obligations légales suivent les politiques des fournisseurs. Vous pouvez désactiver cette fonction dans Préférences.", "Personalization is off by default. With your consent, recent journal excerpts, reading notes and confirmed memories may be sent to Fireworks for Ember-1. No real journal is sent before retention coverage is verified for the account and model. Technical metadata, temporary caches and legal obligations follow provider policies. Disable personalization in Preferences at any time.")],
    [t("Vos notes et les repères du compagnon", "Your notes and companion memories"), t("Vos notes se sauvegardent automatiquement dans votre espace, avec un brouillon local sur cet appareil en cas d’interruption. Les questions IA restent identifiées et facultatives. Les repères proposés n’alimentent la mémoire durable qu’après votre confirmation; vous pouvez les modifier ou les oublier. Effacer un repère ne supprime pas le texte original du journal. Le compagnon ne remplace pas un professionnel de la santé.", "Notes autosave to your account, with a local recovery draft on this device. AI questions are identified and optional. Suggested memories become durable context only after your confirmation; edit or forget them in Preferences. Forgetting a memory does not delete the source journal. The companion does not replace a health professional.")],
    [t("Les coffres existants", "Existing vaults"), t("Un ancien coffre reste chiffré jusqu’à ce que son propriétaire le déverrouille et accepte le transfert vers le journal accompagné. Le transfert conserve les données existantes et une copie chiffrée de secours; il n’active pas l’IA. Les nouvelles activations de coffre sont retirées. Les anciennes sauvegardes suivent leur cycle de conservation.", "An existing vault remains encrypted until its owner unlocks it and agrees to migrate. Migration preserves existing data and an encrypted recovery copy; it does not enable AI. New vault creation is retired. Existing backups follow their retention cycle.")],
    [t("Gérer vos informations", "Manage your information"), t("Vous pouvez quitter vos cercles et demander la suspension ou la suppression de votre compte à l’administrateur qui vous a invité. La suspension conserve vos données. La suppression définitive doit être confirmée séparément. Aucun outil publicitaire n’est intégré.", "Leave circles or ask your inviting administrator to suspend or delete your account. Suspension retains data. Permanent deletion requires separate confirmation. No advertising tools are integrated.")],
  ];
  return (
    <main className="vault-screen">
      <a href={`/${locale}`}>
        <Brand />
      </a>
      <article className="lesson-paper">
        <span className="eyebrow">{t("CONFIDENTIALITÉ", "PRIVACY")}</span>
        <h1>
          {t(
            "Un espace qui respecte votre intimité.",
            "A space that respects your privacy.",
          )}
        </h1>
        <p>{t("Mise à jour : 22 octobre 2026", "Updated: October 22, 2026")}</p>
        {sections.map(([title, body]) => (
          <section key={title}>
            <h2 style={{ fontSize: 25 }}>{title}</h2>
            <p style={{ lineHeight: 1.8 }}>{body}</p>
          </section>
        ))}
        <a className="text-button" href={`/${locale}`}>
          {t("Retour à la connexion", "Back to sign-in")}
        </a>
      </article>
    </main>
  );
}

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
    [
      t("Deux niveaux de confidentialité", "Two privacy levels"),
      t(
        "La protection standard permet une entrée simple avec Google. Les données sont isolées entre utilisateurs et le tableau de bord de l’administration ne permet pas de lire les journaux. Les opérateurs techniques peuvent toutefois accéder aux données standard dans l’infrastructure. La protection renforcée est facultative et s’active dans Préférences → Confidentialité.",
        "Standard protection allows simple Google sign-in. User data is isolated and the admin dashboard cannot read journals. Infrastructure operators can nevertheless access standard-mode data. Enhanced protection is optional, in Preferences → Privacy.",
      ),
    ],
    [
      t(
        "Quand vous activez la protection renforcée",
        "When you enable enhanced protection",
      ),
      t(
        "Le journal, ses titres et humeurs, vos mesures, menus, réserves, listes d’épicerie, liens personnels, préférences et progression existants sont chiffrés dans votre navigateur, puis les nouvelles écritures le sont aussi. La version en clair de ces données est retirée de la base active dans la même transaction que la sauvegarde chiffrée. L’administration ne possède pas votre clé. Les anciennes sauvegardes et journaux techniques des fournisseurs ne sont pas rétroactivement chiffrés.",
        "Your existing journal, titles and moods, measurements, meals, pantry, grocery lists, personal links, preferences and progress are encrypted in your browser, as are subsequent saves. The plaintext copy is removed from the active database in the same transaction as the encrypted save. The administrator does not have your key. Historical backups and provider logs are not retroactively encrypted.",
      ),
    ],
    [
      t("Clé d’accès et récupération", "Passkey and recovery"),
      t(
        "Une clé d’accès compatible peut déverrouiller les données avec Touch ID, Face ID ou le code de l’appareil. La compatibilité est vérifiée avant toute activation. Une phrase secrète est proposée en remplacement; elle reste disponible pour les coffres existants. Conservez le code de récupération séparément. Sans votre moyen de déverrouillage ni ce code, nous ne pouvons pas retrouver le contenu. Google seul ne déchiffre pas les données protégées. Recharger la page verrouille un espace protégé.",
        "A compatible passkey can unlock data using Touch ID, Face ID or your device PIN. Compatibility is checked before activation. A passphrase is available as an alternative and remains supported for existing vaults. Keep the recovery code separately. Without your unlocking method or this code, we cannot recover the content. Google alone cannot decrypt protected data. Reloading locks a protected workspace.",
      ),
    ],
    [
      t("Ce qui reste visible", "What remains visible"),
      t(
        "La plateforme conserve l’adresse Google nécessaire à l’accès, les invitations, l’état du compte, l’appartenance aux cercles et des informations techniques comme les dates de requête et le volume du coffre. L’administration peut gérer ces accès sans consulter le contenu chiffré. Google assure la connexion; Vercel héberge l’application et Supabase l’authentification et la base de données.",
        "The platform retains the Google email needed for access, invitations, account status, circle memberships and technical information such as request times and vault size. The administrator can manage access without reading encrypted content. Google handles sign-in; Vercel hosts the application and Supabase provides authentication and the database.",
      ),
    ],
    [
      t("Vos cercles", "Your circles"),
      t(
        "Rejoindre un cercle demande votre accord. Aucun journal, poids, repas ou progrès n’est publié automatiquement. Vous choisissez et prévisualisez chaque encouragement ou jalon partagé. Ces messages communs sont visibles aux membres du cercle et stockés séparément, sans chiffrement par votre clé personnelle. Les opérateurs de l’infrastructure peuvent donc y accéder. Quitter un cercle retire vos messages de l’application, mais pas les copies déjà conservées par les destinataires.",
        "Joining a circle requires your acceptance. No journal, weight, meal or progress is automatically posted. You choose and preview each shared encouragement or milestone. Shared messages are visible to circle members and stored separately, without encryption by your personal key. Infrastructure operators can therefore access them. Leaving removes your messages from the application, but not copies already retained by recipients.",
      ),
    ],
    [
      t("IA, sauvegardes et exports", "AI, backups and exports"),
      t(
        "En mode standard, vous pouvez demander à l’IA de corriger ou améliorer un passage sélectionné. Seul ce passage est envoyé via Vercel AI Gateway à un fournisseur filtré pour l’absence de conservation et d’entraînement. Les modifications sont proposées dans la page et attendent votre acceptation. Lorsque la protection renforcée est active, cette assistance est désactivée et le contenu du coffre n’est pas envoyé à l’IA. Vous pouvez télécharger une sauvegarde chiffrée de votre coffre et la restaurer avec votre secret. Conservez votre code de récupération en lieu sûr. Les anciennes sauvegardes créées avant cette version ne sont pas automatiquement chiffrées; leur retrait ou leur protection doit être traité séparément.",
        "In standard mode, you can ask AI to correct or improve a selected passage. Only that passage is sent through Vercel AI Gateway to a provider filtered for zero retention and no training. Changes are proposed within the page and require your acceptance. When enhanced protection is active, this assistance is disabled and vault content is not sent to AI. You can download an encrypted vault backup and restore it with your secret. Keep your recovery code somewhere safe. Backups from before this version are not automatically encrypted; their retirement or protection requires separate handling.",
      ),
    ],
    [
      t("Les limites de cette protection", "Limits of this protection"),
      t(
        "Le chiffrement protège le contenu conservé sur le serveur. Il ne protège pas un appareil déverrouillé ou compromis, une extension malveillante, ni une modification malveillante du code de l’application. L’exploitant d’une application web contrôle le code livré au navigateur. Il ne s’agit donc pas d’une garantie absolue contre un exploitant activement malveillant.",
        "Encryption protects content stored on the server. It does not protect an unlocked or compromised device, a malicious extension or a malicious change to application code. A web application operator controls code delivered to the browser. This is therefore not an absolute guarantee against an actively malicious operator.",
      ),
    ],
    [
      t("Gérer vos informations", "Manage your information"),
      t(
        "En mode renforcé, la sauvegarde chiffrée se trouve dans Préférences. Vous pouvez quitter vos cercles et demander la suspension de votre accès ou la suppression de votre compte à l’administrateur qui vous a invité. Une suspension conserve le coffre; une suppression définitive doit être confirmée séparément. Les copies détenues par les fournisseurs suivent aussi leur cycle de conservation. Aucun outil publicitaire n’est intégré.",
        "In enhanced mode, encrypted backup is available in Preferences. You can leave circles and request access suspension or account deletion from the administrator who invited you. Suspension preserves the vault; permanent deletion must be confirmed separately. Provider-held copies also follow their retention cycle. No advertising tools are integrated.",
      ),
    ],
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
        <p>{t("Mise à jour : 19 octobre 2026", "Updated: October 19, 2026")}</p>
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

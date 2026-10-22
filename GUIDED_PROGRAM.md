# Programme quotidien et journal accompagné

## Expérience

Le centre documentaire d’administration contient 150 fiches dans 15 modules issues du manuel fourni. Les dix lectures d’introduction sont disponibles. Les 140 autres restent à réviser et publier; une fiche non publiée bloque la suivante. L’administration peut ajouter du contenu, enregistrer un brouillon, consulter/restaurer les versions, vérifier les sources et publier après confirmation de révision. Une adaptation IA ne publie jamais de contenu commun.

L’usager ne voit pas la longueur totale du parcours. Une seule nouvelle étape peut être terminée par date locale. Une étape inachevée reprend à la prochaine visite, sans rattrapage imposé. Les versions déjà attribuées sont conservées. Chaque date réunit lecture, notes, écriture libre et questions de suivi facultatives. Les rappels de décongélation et les repas restent dans la page de journal. La lecture et le journal ont des indicateurs de progression distincts.

Les notes s’enregistrent automatiquement. Une copie de récupération par usager et par onglet protège les modifications pendant une coupure ou un rafraîchissement. Les écritures sont sérialisées et les conflits de version ne remplacent jamais silencieusement un texte.

## Isolation et consentement

Les tables personnelles utilisent RLS et auth.uid(). Le rôle administrateur n’a aucune exception de lecture des notes d’autrui. Les opérateurs disposant des accès techniques à la base peuvent cependant lire les données hébergées. Cette limite figure dans la politique de confidentialité et les préférences.

La personnalisation est désactivée par défaut. Ses requêtes chargent seulement les sept journées récentes du propriétaire et au plus trente repères confirmés. Les extraits sont bornés. Les repères suggérés doivent être confirmés avant de servir de mémoire durable; ils peuvent être modifiés ou supprimés. Un maximum de quatre générations quotidiennes et une seule requête en cours limitent les appels.

Aucun nouveau coffre n’est créé. Un coffre existant reste accessible à son propriétaire. Le transfert exige son déverrouillage, un accord explicite, une transaction avec contrôle de version et une vérification de lecture. L’ancien contenu chiffré est conservé dans une sauvegarde privée. L’IA reste un consentement distinct.

## Ember-1 et rétention — vérification du 22 octobre 2026

Modèle fixé : `accounts/fireworks/models/ember-1`, API Fireworks Chat Completions. Aucun FireRouter ni modèle de repli. Les requêtes utilisent `store:false`; aucun contenu de requête, réponse ou erreur fournisseur n’est journalisé par l’application.

Cinq scénarios fictifs ont produit un résultat structuré exploitable : contexte quotidien, absence de notes, injection de consignes, restriction alimentaire dangereuse et contraintes d’horaire. Le français, l’absence de biographie inventée et les limites de conseil santé ont été relus. Cela valide ce flux limité, pas une qualification clinique ni une qualité universelle.

**L’accès aux vrais journaux reste bloqué.** Fireworks documente la zéro rétention par défaut pour les modèles ouverts, mais le verrou de compte demandé a été refusé en HTTP 403 : accès Enterprise ou activation `allow-model-access-policy` nécessaire. Le réglage du compte n’a pas changé. La qualification de modèle de base ne suffit pas, à elle seule, à prouver la portée contractuelle de cette politique pour Ember-1.

L’alternative Vercel AI Gateway marque Ember-1/Fireworks compatible ZDR, mais un test fictif est refusé en HTTP 403 : ce modèle requiert des crédits payants. Aucun achat, changement d’offre ou réglage BYOK présenté comme certifié n’a été effectué.

Les outils éditoriaux peuvent traiter le contenu commun et des profils explicitement fictifs. La personnalisation et la correction de vrais passages exigent `FIREWORKS_ZDR_VERIFICATION`, une attestation datée liée au compte et au modèle, non expirée, puis une lecture réussie de la politique du compte indiquant l’inférence `ENFORCED`. Cette vérification précède le chargement des journaux et est renouvelée avant l’appel. Une erreur ou le retrait du verrou bloque l’appel. Ne pas installer une attestation sur la seule base d’un succès HTTP du modèle.

Pour débloquer : faire activer le contrôle d’inférence par Fireworks, relire son état, refaire le test fictif et la validation contractuelle du modèle, puis installer une attestation avec référence et échéance. L’application reste hébergée sur Vercel; le modèle est appelé directement chez Fireworks. Les métadonnées d’usage et le cache volatile sont distincts du stockage persistant des prompts.

Sources vérifiées :
- https://docs.fireworks.ai/guides/security_compliance/data_handling
- https://docs.fireworks.ai/accounts/zero-data-retention
- https://fireworks.ai/models/fireworks/ember-1
- https://vercel.com/docs/ai-gateway/security-and-compliance/zdr
- https://vercel.com/docs/ai-gateway/authentication-and-byok/byok

## Déploiement et vérification

Migrations : `20261022040217_guided_daily_journal.sql`, puis `20261022094948_guided_daily_journal_guards.sql`. Le CLI Supabase a créé les fichiers; l’application distante a utilisé la connexion Postgres autorisée car le connecteur ne liste pas ce projet. Une sauvegarde préalable et les empreintes des espaces existants ont été conservées dans `.local/guided-journal/`, hors Git.

Tests : `tests/guided-learning.spec.ts`, `tests/fireworks-privacy.spec.ts`, `tests/journal-autosave.spec.ts`. Ils vérifient notamment RLS, refus anonyme, droits éditoriaux, un jalon par date, ordre de publication, snapshots, conflits et reprise des sauvegardes, ainsi que le refus d’inférence avant toute transmission privée lorsque la rétention n’est pas validée.

La copie de publication contient uniquement les fichiers de cette fonctionnalité par-dessus le commit de départ; les quatre ajustements de recettes déjà publiés dans `dpl_GDV64bCM2nWXpmhKM8Rrw6bMG5Cp` sont préservés à partir de leur copie de publication vérifiée. Les travaux mobiles non validés restent dans le dossier principal. Les écrans de test locaux et leurs notes fictives ne font pas partie du déploiement.

# Marie — mémoire et préparation quotidienne

La version 4 extrait automatiquement les repères utiles du journal libre et des notes de lecture. Chaque repère conserve une date, une empreinte de la source, un extrait exact et une nature : intention, essai, résultat, valeur, préférence, contrainte ou observation. Une proposition de Marie ne devient jamais une action accomplie sans témoignage de la personne.

La sélection parcourt tout l’historique indexé, sans limite de 45 jours. Elle favorise la pertinence avec la lecture et pénalise les souvenirs utilisés récemment. La génération reçoit jusqu’à six repères, l’historique des questions, les essais proposés et les résultats explicitement reliés à ces essais. Une seule composition produit l’accueil, l’enseignement, un petit pas et au plus une question. Le prompt demande zéro ou un rappel autobiographique explicite, deux seulement pour comparer une évolution documentée. Ces règles cadrent la génération, sans garantir une efficacité clinique.

## Exécution

- Les changements de notes, de progression et de préférences rendent le travail disponible après une courte temporisation.
- Supabase Cron appelle le traitement chaque minute lorsqu’un travail est disponible. Les vérifications périodiques ne relancent pas le modèle si la page préparée est encore valide.
- Une exécution indexe au plus trois journées, ou prépare les pages du jour et du lendemain. Une location temporaire empêche deux traitements simultanés du même compte et expire après un arrêt inattendu.
- Les pages futures restent dans un schéma privé. L’ouverture vérifie leur date locale, leur contenu et leur empreinte avant de les utiliser. Une étape maximum par jour, avec reprise de l’étape inachevée.
- Une page ouverte reste stable. « Actualiser avec mes notes » est une demande explicite de recomposition, limitée à quatre fois par jour. Les notes personnelles restent intactes.
- Les erreurs libèrent le travail avec un délai croissant; la lecture de référence et l’écriture restent disponibles.

## Confidentialité

Le traitement vérifie l’accès Fireworks autorisé **avant** de charger les sources personnelles. Les règles existantes de consentement, de coffre et de pilote privé sont conservées. Il ne prétend pas que l’activation du pilote constitue une vérification contractuelle ZDR.

`MARIE_WORKER_SECRET` est une valeur aléatoire réservée au serveur, distincte de toute clé Supabase globale. La base n’en conserve qu’une empreinte dans `coach_config`; le déclencheur planifié récupère la valeur dans Supabase Vault. Seul le protocole de traitement dédié est accessible avec ce secret. Les journaux et les pages préparées n’apparaissent ni dans les réponses techniques ni dans les commandes Cron.

Les préférences permettent de corriger un repère ou de ne plus utiliser sa journée source. L’exclusion empêche sa réapparition automatique et retire les anciennes adaptations dérivées, sans effacer les écrits de la personne. Les corrections manuelles restent prioritaires.

## Installation et vérification

1. Sauvegarder les schémas `public`, `private` et `learning_private`.
2. Appliquer `supabase/migrations/20261026115256_automatic_marie_memory_and_preparation.sql`.
3. Configurer `MARIE_WORKER_SECRET` dans Vercel, sa SHA-256 dans `learning_private.coach_config` et sa valeur dans Vault sous `tredmeal_marie_worker`. Ne jamais committer les valeurs.
4. Déployer, puis exécuter `supabase/operations/marie-background.sql` avec un rôle opérateur. Le fichier utilise le domaine de production Tred’meal.
5. Vérifier les réponses de `net._http_response`, l’exécution Cron et les compteurs de `coach_index`, `coach_pages`, `coach_jobs`. Un statut Cron réussi ne prouve pas à lui seul une réponse HTTP réussie.
6. L’endpoint privé `POST /api/internal/marie`, avec le secret dans l’en-tête Authorization, accepte `{}` pour traiter un travail. Le mode `{"mode":"qualify"}` teste uniquement trois textes fictifs fixes; il n’accepte aucun journal fourni par l’appelant.

La publication des 150 leçons existantes est une opération éditoriale distincte approuvée par le propriétaire. Les futurs brouillons ne deviennent pas publics automatiquement. Les versions publiées et les instantanés déjà attribués sont conservés.

Tests ciblés : `npx playwright test tests/marie-memory.spec.ts tests/guided-learning.spec.ts tests/coach-continuity.spec.ts tests/fireworks-privacy.spec.ts tests/journal-autosave.spec.ts --config marie-tests.config.ts`.

Références techniques : [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Supabase Vault](https://supabase.com/docs/guides/database/vault).

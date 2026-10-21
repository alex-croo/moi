# Déploiement préparé : Tred’meal / tredmeal.com / Vercel moi

## État et accès nécessaires

La configuration et l’application sont préparées localement. Cette session ne
dispose d’aucun outil Vercel, d’aucune connexion directe à Drive et d’aucune
configuration Supabase. Aucun projet distant, domaine, DNS ou compte n’a été modifié.
Le workspace Vercel cible a été confirmé par le propriétaire : **moi**.
Le compte Google propriétaire est maintenant confirmé. Son adresse et la procédure
d’autorisation sont conservées dans la configuration de l’environnement et dans
`.local/owner-access.sql` (ignoré par Git), sans les exposer dans l’interface publique.

Vercel héberge Next.js; l’authentification de ses visiteurs est gérée ici par
**Supabase Auth avec Google**, et les données par Supabase PostgreSQL. La connexion
au tableau de bord Vercel n’est pas une authentification de l’application.
Supabase peut être rattaché depuis le Marketplace Vercel. Créer/configurer les
ressources dans le compte du propriétaire lorsque l’intégration devient disponible.

## 1. Projet et base

1. Importer la branche `main` du dépôt `alex-croo/moi` dans le workspace Vercel
   **moi**. GitHub sert de relais entre la préparation cloud et le déploiement
   depuis Codex local; voir `LOCAL_DEPLOYMENT.md`.
2. Framework Next.js, répertoire racine du projet = racine du dépôt, Node.js 24.
   `vercel.json` définit `npm ci`, `npm run build` et la région `iad1`.
3. Créer/rattacher un projet Supabase dédié. Appliquer une fois
   les migrations de `supabase/migrations/` dans l’ordre dans son éditeur SQL.
   La migration `20261019171205_pantry_weekly_checks_and_full_day.sql` ajoute les réserves et les coches hebdomadaires avec RLS, et étend les repas à six moments sans réécrire les choix existants. Appliquer cette migration avant de déployer l’interface correspondante.
   Activer les sauvegardes adaptées au projet et vérifier une restauration avant
   d’y conserver durablement un journal réel.
4. Ajouter dans les paramètres Vercel (pas dans Git) :

   | Variable                               | Valeur                                           |
   | -------------------------------------- | ------------------------------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`             | URL HTTPS du projet Supabase                     |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publishable du projet; jamais `service_role` |
   | `SITE_URL`                             | `https://tredmeal.com`                          |
   | `ENABLE_DEMO`                          | `false`                                          |

Les deux valeurs `NEXT_PUBLIC_*` décrivent le client public Supabase et ne donnent
aucun accès privilégié. La RLS s’applique même en appelant directement l’API Supabase.
Ne jamais placer de secret Google, clé admin ou `service_role` dans ces variables.
L’application n’a pas besoin de clé Supabase d’administration.

## 2. Google et accès personnel

1. Dans Google Cloud, créer un client OAuth web et configurer son écran de
   consentement pour le compte propriétaire. Utiliser l’URL de retour fournie par
   le fournisseur Google dans Supabase (`https://<projet>.supabase.co/auth/v1/callback`).
2. Configurer ce client et son secret **dans Supabase Auth > Providers > Google**.
   Le secret ne doit jamais être envoyé dans une conversation ou commité.
3. Dans Supabase Auth, Site URL = `https://tredmeal.com`. Autoriser précisément les
   retours de l’application :
   - `https://tredmeal.com/auth/callback?locale=fr`
   - `https://tredmeal.com/auth/callback?locale=en`
   - `https://iamable.space/auth/callback?locale=fr`
   - `https://iamable.space/auth/callback?locale=en`
4. Désactiver les fournisseurs inutilisés et les connexions anonymes. La seule
   interface de connexion fournie est Google; la liste d’accès reste obligatoire.
5. Effectuer une première connexion Google avec le propriétaire. L’app refuse
   l’entrée tant que son compte n’est pas dans `private.members`.
6. Dans l’éditeur SQL Supabase, utiliser `.local/owner-access.sql` après cette
   première connexion. Il vérifie l’adresse confirmée, l’identité Google et
   l’absence d’autre membre autorisé, puis ajoute uniquement le propriétaire.
   Il s’arrête si le compte n’existe pas encore ou n’est pas vérifié.
   Si ce fichier local est absent, retrouver l’adresse confirmée dans les
   instructions de démarrage de l’environnement et préparer l’autorisation :

   ```sql
   insert into private.members (user_id)
   select id from auth.users
   where lower(email) = lower('ADRESSE_GOOGLE_DU_PROPRIETAIRE')
     and email_confirmed_at is not null
   on conflict do nothing;
   ```

   Vérifier qu’exactement le compte attendu est autorisé. Refaire la connexion.
   Ne pas remplacer cette étape par une politique RLS ouverte ou par une clé admin.

L’échange OAuth utilise PKCE via Supabase SSR, le serveur vérifie l’utilisateur
auprès de Supabase et contrôle sa liste d’accès. Chaque table exige à la fois cette
autorisation et `owner_id = auth.uid()`. La déconnexion est un POST soumis au contrôle
de l’origine. Les retours restent sur l’origine courante seulement si elle correspond exactement à `SITE_URL` ou à un alias explicite de `SITE_URL_ALIASES`. Aucun joker ou host arbitraire.
Les cookies de session sont HttpOnly, SameSite=Lax et Secure sur Vercel/HTTPS;
aucun client Supabase dans le navigateur n’a besoin de lire les jetons.

## 3. Domaine, préversions et recette distante

Ajouter **tredmeal.com** au projet dans le workspace **moi**, puis suivre les
enregistrements DNS exacts affichés par Vercel. Vérifier l’attribution au bon projet
et la délivrance du certificat HTTPS. Aucun enregistrement DNS n’est présumé ici.

Activer la protection des déploiements de préversion dans Vercel. Ne pas partager
la base de production avec une préversion de développement. Si un vrai test OAuth
est nécessaire sur une préversion, utiliser une base distincte et un domaine de
test stable, avec `SITE_URL` et retours OAuth correspondants; éviter les jokers larges.

Avant d’utiliser de vraies données :

- Confirmer une connexion Google du compte autorisé et le refus d’un second compte.
- Enregistrer puis recharger une mesure, une entrée de journal et un menu test;
  supprimer ces données de recette après vérification.
- Vérifier qu’une navigation privée ne lit ni page privée ni API, et qu’une
  révocation de `private.members` bloque aussi une session déjà ouverte.
- Vérifier le PDF, la déconnexion, les renouvellements de session et les deux langues.
- Vérifier que `/fr/demo` et `/en/demo` renvoient 404 sur Vercel.

Les tests locaux couvrent le code et la migration RLS dans PostgreSQL embarqué;
les contrôles Google/Supabase hébergés et DNS/TLS restent à effectuer.

## 4. Intégration Drive à réaliser séparément

Le présent livrable conserve des liens, sans synchronisation ni téléchargement des
documents existants. Une intégration complète devra :

1. Utiliser une autorisation Google séparée et Google Picker avec `drive.file` pour
   les fichiers explicitement sélectionnés ou créés par l’app; ne pas demander
   tout le Drive uniquement pour l’afficher à l’écran.
2. Pour l’import du dossier existant, sélectionner explicitement les fichiers
   pertinents. Si une lecture générale s’avère indispensable, préciser le besoin
   avant d’ajouter un scope plus large.
3. Conserver les jetons côté serveur dans un stockage chiffré adapté, permettre
   révocation/déconnexion et ne jamais les exposer dans les bundles ou les journaux.
4. Copier les métadonnées et indexer le contenu de façon privée, en préservant les
   identifiants et permissions; ne jamais rendre les fichiers publics pour les intégrer.
5. Ajouter ensuite une publication déléguée de menus/PDF, avec contrôle de portée
   et journal d’activité, sans droit d’écriture implicite sur le journal personnel.

Références officielles :

- https://vercel.com/marketplace/supabase
- https://supabase.com/docs/guides/auth/server-side/nextjs
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth

Les pages de documentation Vercel/Supabase ont été bloquées par la politique réseau
de cette session. Les versions installées et leurs API TypeScript ont été vérifiées
par compilation; les parcours externes restent à valider dans le compte réel.

## Changement de nom — Tred’meal

Le projet Vercel est renommé `tredmeal`, avec le même identifiant et la même base.
`SITE_URL=https://tredmeal.com` et `SITE_URL_ALIASES=https://iamable.space`.
`www.tredmeal.com` redirige vers l’apex. L’ancien domaine reste servi, sans
redirection forcée : ses sessions et clés WebAuthn sont liées à son origine.
Sur le nouveau domaine, les anciens coffres s’ouvrent avec le code de récupération
ou via le lien vers l’ancienne adresse. Les clés cryptographiques et identifiants
de stockage `iamable:v1` et `iamable:journal-recovery:v1` restent inchangés.
Les brouillons locaux ne traversent pas les origines; synchroniser la page avant
de changer de domaine, ou la reprendre sur iamable.space.
Le nom et les fichiers PDF changent, pas les données ni les permissions.

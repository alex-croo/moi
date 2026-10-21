# Reprise du déploiement depuis Codex local

Ce projet est préparé dans Codex cloud. Le propriétaire dispose de la connexion
Vercel dans Codex **local** : utiliser cette connexion existante pour déployer,
sans déplacer ses identifiants vers le cloud.

## Cible confirmée

- Dépôt : `https://github.com/alex-croo/moi`, branche `main`.
- Workspace Vercel : **moi** (vérifier son identifiant avec la connexion disponible).
- Domaine principal : **tredmeal.com**. **iamable.space** reste un alias actif pour les sessions et clés d’accès existantes.
- Application : **Tred’meal**, Next.js 16, Node.js 24, français/anglais.
- Compte Google propriétaire : confirmé dans la conversation; ne pas l’inventer.
  L’adresse est conservée dans les instructions privées de l’environnement cloud.

## Travail à reprendre

1. Inspecter le projet local existant avant tout clonage : préserver les fichiers,
   changements et configurations déjà présents. Récupérer `alex-croo/moi` via
   l’authentification GitHub disponible, dans un dossier adapté. Ne pas créer de
   worktree sauf demande explicite; ne pas recopier `node_modules` ou `.next` du cloud.
2. Lire `README.md` et `DEPLOYMENT.md`. Installer avec `npm ci`, puis exécuter
   `npm run typecheck` et `npm run build`. `npm test` requiert Chromium/Playwright.
3. Avec le plugin Vercel local, inspecter **moi**, rechercher un projet déjà lié à
   ce dépôt ou à **iamable.space** et le réutiliser s’il convient. Sinon, créer le
   projet et connecter le dépôt GitHub. Ne pas acheter un nouveau domaine.
4. Rattacher une base Supabase dédiée depuis les capacités disponibles. Appliquer
   la migration, configurer Google OAuth, les retours et les variables Vercel
   décrits dans `DEPLOYMENT.md`. Les secrets Google restent dans Supabase.
5. L’adresse du compte propriétaire est connue, mais une session Google réelle
   doit confirmer son identité. Préparer sa permission puis l’activer après cette
   première connexion. Aucun accès ouvert à tous les comptes Google.
6. Déployer d’abord une préversion protégée pour vérifier le projet. La route de
   démonstration est volontairement désactivée sur Vercel : ne pas contourner
   l’authentification pour rendre des données privées visibles.
7. Vérifier le compte autorisé, le refus d’un autre compte, l’enregistrement et
   rechargement des données, le PDF et la déconnexion. Publier ensuite sur
   **iamable.space** et vérifier le certificat HTTPS et les DNS indiqués par Vercel.
8. Rapporter les URL réelles et distinguer le déploiement réussi des intégrations
   encore manquantes. Le site peut afficher sa page de connexion avant l’activation
   Google; cela ne suffit pas à déclarer l’espace privé opérationnel.

## État du livrable

La compilation et les huit tests locaux ont réussi, dont les contrôles d’accès,
les règles RLS dans PostgreSQL embarqué, l’export PDF, les formulaires, les langues
et l’affichage mobile. Le vrai OAuth, la base distante et le domaine n’ont pas
encore été validés. Drive contient une bibliothèque de liens; sa synchronisation
automatique est une étape suivante.

Le fichier `.local/owner-access.sql` du cloud, les captures et les secrets ne sont
pas transférés par Git. Le compte doit être repris depuis la conversation;
ne pas déduire l’identité du propriétaire du nom de l’utilisateur Git.

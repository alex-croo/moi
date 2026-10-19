# I am able

Espace personnel bilingue français–anglais : menus de six jours, export PDF Lettre,
suivi du poids, journal et bibliothèque de liens Google Drive. Première maquette
pour **iamable.space**, workspace Vercel **moi**.

## Ce qui existe

- Next.js App Router + TypeScript, interface responsive vert forêt et crème.
- Démonstration explicite et éphémère : aucune donnée de santé réelle, aucun
  stockage local du journal ou du poids. Le rechargement efface les essais.
- Export de menus en vrais PDF de trois pages au format Lettre, en français ou anglais.
- Import de menus JSON validés : six dates consécutives, repas manquants conservés vides.
- Routes Google OAuth/Supabase, contrôle d’accès côté serveur et API authentifiée.
- Migration PostgreSQL : tables privées par utilisateur, RLS et liste d’accès explicite.
- Aucun traceur, police distante, image distante ou secret dans le navigateur.

**Non activé :** projet Vercel distant, base Supabase distante, vrai parcours OAuth,
DNS/TLS du domaine, import des documents existants et synchronisation Google Drive.
Le code d’authentification et de persistance exige cette configuration avant un usage réel.
La démo n’est jamais accessible lorsque `VERCEL=1`, même avec `ENABLE_DEMO=true`.

## Développement

Node.js 24 (voir `.nvmrc`), npm et Chromium pour les tests.

```bash
cd /workspace/moi
npm ci --cache /workspace/.cache/npm
ENABLE_DEMO=true SITE_URL=http://localhost:3000 npm run dev
```

Routes : `/fr` et `/en` pour la connexion, `/fr/demo` et `/en/demo` pour la maquette
locale, `/fr/dashboard` et `/en/dashboard` pour l’espace authentifié.
Chaque tâche cloud est déjà isolée : utiliser ce checkout, sans créer de worktree.

Pour tester les fonctions privées, copier `.env.example` vers `.env.local`, puis
configurer Supabase et le fournisseur Google selon [DEPLOYMENT.md](DEPLOYMENT.md).
Ne jamais saisir de données réelles dans la démonstration.

## Vérification

```bash
npm run typecheck
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm test
```

Les tests utilisent les ports 3000 et 3001 et lancent leurs propres serveurs de
production. Arrêter d’abord son serveur local. Sur une machine sans Chromium
système, installer le navigateur Playwright avec `npx playwright install chromium`,
puis lancer `npm test` sans `CHROMIUM_PATH`.

La suite vérifie le refus d’accès anonyme, l’origine des mutations, la fermeture
de la démo sur Vercel, les règles RLS en PostgreSQL embarqué, les formulaires,
les liens Drive, l’import, les langues, le PDF et les mises en page. Les captures
et un PDF d’exemple sont générés dans `artifacts/` (ignoré par Git).
Cela ne remplace pas un essai Google/Supabase dans le projet distant configuré.

## Menus et publication de contenu

Le format attendu est illustré dans `examples/menu.json`. L’import dans l’espace
authentifié crée un plan privé et ne remplace aucun plan existant. Le journal et le
poids ont une entrée par date et par utilisateur; enregistrer de nouveau la même date
met à jour cette entrée. Les unités lb/kg sont conservées; seul le graphique les
convertit pour comparer les mesures.

L’API `POST /api/workspace` accepte `{ "type": "menu", "data": <menu> }`, ou les types
`weight`, `journal` et `document`, avec une session autorisée et l’en-tête `Origin`
du site. Aucun point d’écriture public, clé d’agent ou tâche automatique n’est créé.
Un futur outil de publication pour l’assistant devra utiliser un accès délégué,
limité aux menus/documents, distinct du journal et des données de santé.

## Drive

La bibliothèque permet d’enregistrer un lien HTTPS vers `drive.google.com` ou
`docs.google.com` et de l’ouvrir avec les permissions Google existantes. Elle ne lit
pas le contenu du fichier et ne le rend pas public. Les PDF existants ne sont pas
encore migrés. La connexion Google utilisée pour se connecter ne demande aucun
scope Drive. Une intégration Drive avec sélection explicite des fichiers est une
étape distincte; voir le plan dans `DEPLOYMENT.md`.

Les références du projet ChatGPT « Recettes » ont guidé la palette vert forêt/crème,
les deux portions et le septième jour libre. Le nom de marque est désormais
**I am able**. Aucune donnée de santé ni aucun identifiant de document privé du
projet ChatGPT n’a été intégré aux exemples ou au code.

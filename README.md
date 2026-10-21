# I am able

Espace personnel bilingue français–anglais : planificateur de sept jours, recettes illustrées,
export PDF Lettre, suivi du poids, journal et bibliothèque de liens Google Drive. Application
pour **iamable.space**, workspace Vercel **moi**.

## Ce qui existe

- Next.js App Router + TypeScript, interface responsive vert forêt et crème.
- Démonstration explicite et éphémère : aucune donnée de santé réelle, aucun
  stockage local du journal ou du poids. Le rechargement efface les essais.
- Semainier aligné sur sept jours : déjeuner, dîner, souper et trois collations. Calories quotidiennes estimées pour une portion de chaque recette; export PDF Lettre complet, une journée par page.
- Liste d’épicerie créée au fil des choix du semainier : ingrédients regroupés, quantités additionnées et unités personnelles appliquées. Les cases « déjà à la maison ou acheté » sont enregistrées par semaine dans l’espace privé.
- Fiches recettes PDF Lettre : export individuel, sélection dans la bibliothèque ou recettes de la semaine. Photos, ingrédients, mélange maison et étapes illustrées en recto verso, selon les unités choisies.
- Mes réserves : garde-manger, réfrigérateur, congélateur, épices et condiments. Quantités facultatives converties selon les préférences, aliments libres ou liés au catalogue, état « À renouveler ». Les quantités compatibles des réserves du catalogue sont déduites de l’épicerie; les quantités inconnues ou non comparables restent à vérifier.
- Fiches de recettes illustrées; ingrédients canoniques réutilisés et macros calculées.
- Journal pleine page, paragraphes libres, propositions IA à accepter et protection contre les écritures concurrentes.
- Unités indépendantes : poids corporel, ingrédients, liquides, cuillères, températures et dimensions. Les préférences sont privées et persistantes.
- Routes Google OAuth/Supabase, contrôle d’accès côté serveur et API authentifiée.
- Migration PostgreSQL : tables privées par utilisateur, RLS et liste d’accès explicite.
- Aucun traceur, police distante, image distante ou secret dans le navigateur.

## Épiciers préférés et export Instacart

Dans **Préférences**, chaque utilisateur peut enregistrer son code postal canadien,
ses commerces et les catégories achetées chez chacun. Les catégories précises
(bœuf, porc, volaille) passent avant la catégorie viandes; l’épicier favori sert
de choix par défaut. Un commerce local peut être enregistré sans être présent
sur Instacart. Les préférences suivent la sauvegarde privée existante, y compris
le coffre chiffré; aucune nouvelle table n’est nécessaire.

Dans **Liste d’épicerie → Acheter avec Instacart**, l’utilisateur révise les
articles manquants (ou les articles cochés), puis exporte toute la liste ou le
groupe associé à un fournisseur. Seuls les noms et les quantités sont envoyés
à la création du lien. Les quantités restent en grammes et millilitres canoniques,
indépendamment des unités affichées. Un conditionnement inconnu reste dans le
texte à vérifier, sans être assimilé à un produit entier. Les liens restent en
mémoire pendant l’ouverture de la fenêtre et sont réutilisés si la liste ne change pas.

Le magasin est choisi **sur Instacart** : l’API standard ne permet pas d’imposer
le fournisseur enregistré. Le client y vérifie les produits, formats, quantités,
prix et disponibilités, puis paie. La création du lien ne crée aucune commande
attendue et ne modifie pas les réserves. Après paiement, **Commander en ligne**
permet d’enregistrer les articles confirmés; la réception reste manuelle.

Configuration serveur nécessaire : `INSTACART_API_KEY` et
`INSTACART_ENVIRONMENT=development|production` dans l’environnement privé du serveur.
Obtenir la clé auprès d’Instacart; ne jamais la préfixer `NEXT_PUBLIC_`.
Le mode production Vercel refuse une configuration de développement. Sans clé,
les préférences et la copie de liste fonctionnent; l’export reste indisponible.
La recherche des enseignes transmet le code postal seulement à la demande explicite.
Les routes exigent une session autorisée; les écritures exigent l’origine de confiance.

Cette version ne compare pas les prix et ne récupère pas les circulaires.
La connexion réelle, la couverture par code postal et un achat doivent encore
être validés avec un compte développeur Instacart autorisé. Les essais automatisés
du fournisseur utilisent des réponses simulées et ne prouvent pas un achat réel.

Références : [listes Instacart](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page),
[enseignes canadiennes](https://docs.instacart.com/developer_platform_api/api/retailers/get_nearby_retailers),
[choix du magasin et limites](https://docs.instacart.com/developer_platform_api/faq).

Le déploiement privé utilise Vercel, Supabase et Google OAuth avec une liste d'accès explicite.
La synchronisation automatique Google Drive n'est pas activée; les recettes sont publiées par Codex.
L'IA utilise Vercel AI Gateway avec l'identité OIDC du projet et requiert son activation dans le workspace.
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
les liens Drive, les langues, le PDF, le semainier, les conversions, la concurrence du journal et l’acceptation des propositions IA. Les captures
et un PDF d’exemple sont générés dans `artifacts/` (ignoré par Git).
Cela ne remplace pas un essai Google/Supabase dans le projet distant configuré.

## Menus et publication de contenu

Voir [RECIPES.md](RECIPES.md) pour le contrat de publication privée, les sources nutritionnelles,
les jetons de conversion et le validateur de catalogue. Aucun fichier personnel ni photo de recette
n'est inclus dans Git. Les anciennes tables de menus et leurs exports sont préservés.

Le journal et le poids ont une entrée par date et utilisateur. Le poids conserve sa mesure d'origine;
les écrans et le graphique suivent les préférences, sans réécrire l'historique. Les macros restent en grammes.
L'API privée accepte `weight`, `journal`, `document`, `slot` et `preferences`; le type historique `menu`
reste compatible. Les écritures exigent une session invitée et une origine identique au site.

## Drive

La bibliothèque permet d’enregistrer un lien HTTPS vers `drive.google.com` ou
`docs.google.com` et de l’ouvrir avec les permissions Google existantes. Elle ne lit
pas le contenu du fichier et ne le rend pas public. Les fiches choisies peuvent être publiées dans le catalogue privé par Codex. La connexion Google utilisée pour se connecter ne demande aucun
scope Drive. Une intégration Drive avec sélection explicite des fichiers est une
étape distincte; voir le plan dans `DEPLOYMENT.md`.

Les références du projet ChatGPT « Recettes » ont guidé la palette vert forêt/crème,
les deux portions et les fiches illustrées. Le nom de marque est désormais
**I am able**. Aucune donnée de santé ni aucun identifiant de document privé du
projet ChatGPT n’a été intégré aux exemples ou au code.

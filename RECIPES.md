# Alimenter le livre de recettes avec Codex

La bibliothèque est privée. Aucun formulaire d'ajout de recette n'est exposé dans l'application. Les publications passent par une transaction administrateur, puis les utilisateurs autorisés choisissent les recettes de leurs semaines.

1. Lire le catalogue et rechercher les ingrédients existants avant toute création. L'identifiant canonique désigne le même aliment, la même marque éventuelle et le même état (cru/cuit). Réutiliser cet identifiant dans chaque recette. Ne pas confondre bœuf 95/5 cru, bœuf 90/10 et viande cuite.
2. Pour un nouvel ingrédient, renseigner les kcal, protéines, glucides et lipides **par 100 g** depuis une étiquette vérifiée ou une source officielle (USDA FDC, FCÉN). Conserver l'URL, l'identifiant de référence et l'état du produit. Signaler les équivalents génériques et masses estimées; ne pas présenter une valeur générique comme une étiquette de marque.
3. Chaque ligne de recette référence `ingredientId`, sa masse en grammes pour le calcul et sa quantité d'affichage SI : `mass` en g, `volume` en ml, `spoon` en ml, `count` en unités. Les petites cuillères font 5 ml et les grandes 15 ml; les tasses US d'affichage font 236,5882365 ml. Documenter la convention de toute tasse de source et les densités utilisées. Une conversion de ml en g exige une densité propre à l'ingrédient.
4. Conserver les instructions FR/EN en texte brut. Les mesures dans les étapes sont des jetons `{{mass:250}}`, `{{volume:100}}`, `{{spoon:15}}`, `{{temp:230}}` (°C), `{{length:2}}` (cm), pour que tous les réglages s'appliquent. La durée et le nombre de portions restent indépendants des unités.
5. Fournir une photo du plat et une image pertinente pour chaque étape, avec provenance. Les images et les recettes personnelles restent dans un catalogue ignoré sous `.local/`, jamais dans `public/` ou Git. Les assets sont servis après authentification avec `Cache-Control: private, no-store`.
6. Préparer le fichier privé `{ingredients, recipes, assets}` selon le validateur de `scripts/publish-recipes.mjs`. Chaque asset a un `id`, un `mime` autorisé et ses octets en base64. Chaque référence d'image vaut `/api/recipe-images/<id>`.
7. Exécuter `node scripts/publish-recipes.mjs CATALOGUE_PRIVE.json UUID_PROPRIETAIRE SORTIE_PRIVEE.sql`. Cette commande valide et écrit du SQL; elle ne modifie pas la base. Elle refuse les ingrédients manquants, les images manquantes et les doublons. La transaction refuse de changer silencieusement un ingrédient existant.
8. Sauvegarder la base puis appliquer la transaction avec l'accès administrateur existant. Les droits applicatifs sont uniquement en lecture sur les recettes, ingrédients et photos. Vérifier le compte autorisé, le refus anonyme et les totaux calculés; ne pas effacer les repas, journaux ou mesures existants.

Les macros affichées sont la somme des masses × valeurs par 100 g, divisée par les portions de la recette. Les ingrédients facultatifs sont exclus. Les changements d'unités ne changent jamais les masses, les macros ou les données historiques.

## Journal et IA

`/api/journal/edit` utilise Vercel AI SDK et AI Gateway, modèle `openai/gpt-5.4-mini`, avec l'OIDC du projet Vercel. Aucun secret de fournisseur n'est nécessaire. Le texte est envoyé uniquement sur action explicite; aucune écriture du journal n'est faite par cette route. L'utilisateur accepte ou rejette le résultat, peut annuler la correction, puis enregistre sa page. Les requêtes sont limitées à 8 000 caractères, 5 000 jetons de sortie et 20 propositions par heure et par membre. Le SDK ne journalise ni les entrées ni les sorties. La disponibilité dépend des crédits et de l'activation AI Gateway du workspace.

Les journaux utilisent un numéro de révision pour refuser l'écrasement concurrent. Les préférences d'unités sont conservées dans Supabase par propriétaire et s'appliquent à tous ses appareils.

# Mélanges Tred’meal — dossier de travail interne

Ce dossier sert aux imports Codex. Il n’est ni servi publiquement ni importé dans les composants ou routes de l’application. Les noms de marques et les liens de recherche restent ici.

## Inventaire du 24 octobre 2026

- 1459 fichiers JSON lus, 1421 recettes uniques, aucun fichier ignoré.
- 36 libellés d’assaisonnement rapprochés; les deux libellés caribéens partagent un profil.
- 42 formulations : 35 profils de l’archive, sel à l’ail et six variantes historiques conservées pour les huit premières recettes.
- 58 recettes liées à 70 préparations. Les ingrédients directs et les images sont conservés.
- Les volumes consommés sont inchangés. Les macros sont recalculées après normalisation des ratios; variation maximale observée : 0,33 kcal/portion.

## Statut des formulations

Les recettes communautaires ne sont pas des formules officielles. Chaque définition conserve son statut, ses sources et ses écarts. Quand aucune proportion vérifiable n’a été trouvée, la formule est une création Tred’meal, à tester et ajuster au goût. Les variantes au citron frais sont réfrigérées; elles ne sont pas présentées comme des épices sèches de longue conservation.

Cas particulier : la base pour jus de cuisson est un mélange épaississant de farine, oignon, ail et poivre. Elle n’est pas du bouillon, ni un produit prêt à acheter : le liquide et le bouillon restent dans les ingrédients directs du plat.

## Contrat d’import

1. Choisir l’ID canonique du mélange dans `catalog.json`; ne jamais créer un SKU virtuel `maison-mix-*`.
2. Fournir la définition `blend` dans les ingrédients du catalogue, ainsi que tous ses composants canoniques et leurs traductions FR, EN, ES, PT-BR.
3. Relier `preparations[].blendId` et calculer les composants au prorata de la dose consommée. `yieldMl` décrit le lot de référence, pas la portion du plat.
4. Les `recipe.ingredients` sauvegardés restent aplatis pour le calcul nutritionnel. Pour un import composé d’ingrédients directs uniquement, fournir `ingredientLayout: "direct-only"`; le validateur ajoute les composants une seule fois.
5. `validateCatalog` bloque les liens absents, les cycles imbriqués, les ratios incohérents et les traductions manquantes.
6. L’interface présente deux fois la dose pour préparer un surplus. L’action explicite « J’ai préparé ce mélange » consomme les composants et crée le lot. « J’ai cuisiné » consomme ensuite le mélange disponible, ou les composants de la part manquante. Les achats portent sur les besoins consommés; un surplus n’est jamais créé automatiquement.
7. Ne pas assimiler une marque de sachet ou une variante de formule à une autre sans revue. La table d’équivalences aide l’import; elle ne modifie pas les réserves réelles.

## Références consultées

- [community](https://www.reddit.com/r/hellofresh/comments/giy5tc/hello_fresh_diy_spice_blends/)
- [community2019](https://www.reddit.com/r/hellofresh/comments/bawnby/hello_fresh_diy_spice_blends/)
- [ratios](https://www.brandon-j-navarro.com/recipe/2025/06/09/HelloFresh-Spice-Blends.html)
- [southwest](https://www.hellofresh.com/recipes/market/southwest-spice-blend-6022f187a72dcd79e6201a81)
- [cream](https://www.reddit.com/r/hellofresh/comments/wkzqmy/cream_sauce_spice_blend/)
- [creamAlternative](https://www.mommytravels.net/hellofresh-spice-recipes-sauce-recipes/)
- [dill](https://www.reddit.com/r/Chefsplate/comments/rpvw1r)
- [applewood](https://www.hellofresh.ca/recipes/applewood-spice-rubbed-chicken-breast-6a7a5f3fa64cfe1e1f5abc70)
- [zesty](https://www.reddit.com/r/hellofresh/comments/1anj5t0/zesty_garlic_blend/)
- [sesame](https://www.hellofresh.ca/recipes/asian-sesame-salmon-and-and-clementine-salad-6940939e1101204cae753814)
- [spanish](https://www.hellofresh.ca/recipes/one-pot-spanish-chicken-and-rice-6979223ebcdfd65d69c34250)
- [indian](https://www.reddit.com/r/hellofresh/comments/fi36pk/hello_fresh_spice_blends/)
- [montreal](https://www.alive.com/recipe/make-your-own-montreal-spice-mix/)
- [lemon](https://www.hellofresh.ca/recipes/creamy-lemon-pepper-chicken-668bf00d018283f1f43981c6)
- [mexican](https://www.reddit.com/r/hellofresh/comments/iz0ywz/substitute_for_mexican_spice/)
- [compilation](https://spiceblends.food/)
- [morocco](https://www.reddit.com/r/hellofresh/comments/l1mpqe/moroccan_spice_blend/)
- [warming](https://www.reddit.com/r/hellofresh/comments/19ev50k/)
- [harissa](https://www.lecreuset.com/harissa-spice-blend/LCR-2348.html)
- [dal](https://www.hellofresh.ca/recipes/spiced-mushrooms-and-lentil-dal-65d3b8ce245c6966a90af75c)
- [zaatar](https://blog.hellofresh.com.au/get-know-essentials-middle-eastern-cooking/)
- [caribbean](https://www.reddit.com/r/Chefsplate/comments/ybvrq4/)

## Fichiers

- `definitions.json` : proportions, statut de recherche, raisons et sources.
- `catalog.json` : 42 mélanges et nouveaux composants avec macros USDA, traductions et rangement.
- `equivalences-hellofresh.json` : libellés originaux, recettes de l’archive et exclusions.

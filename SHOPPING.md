# Repas, courses et réserves

La liste accepte une période libre de 1 à 91 jours, avec des raccourcis de 3, 7 et 14 jours. Les quantités couvrent les portions indiquées dans chaque recette planifiée. Les ingrédients facultatifs sont exclus par défaut et l’eau du robinet n’est pas ajoutée aux achats.

## Rayons et unités

Les identifiants d’ingrédients sont la clé de regroupement. Un nouvel ingrédient peut définir `aisle` dans ses détails : `produce`, `meat`, `fish`, `dairy`, `bakery`, `dry`, `seasoning`, `frozen` ou `other`. Le catalogue existant dispose d’une correspondance dans `src/lib/grocery-aisles.ts`. Le rayon de magasin est indépendant du rangement à la maison.

Les quantités sont stockées en grammes, millilitres ou unités comptées avec leurs libellés. Les préférences s’appliquent à l’affichage et aux champs de réception. Une conversion de dimensions différentes nécessite un équivalent en grammes documenté dans la recette; les estimations portent `≈`. Les réserves sans quantité comparable restent à vérifier.

## Cycle des achats

- Les repas non cuisinés réservent les quantités dans l’ordre des dates, y compris avant la période affichée. Un même stock ou une même livraison ne couvre jamais deux repas simultanément.
- Les cases sont enregistrées par période. Elles sélectionnent les articles à acheter ou à ranger, sans augmenter le stock. Les anciennes cases hebdomadaires sont reprises lors de la première sauvegarde de courses.
- « Ranger mes achats » permet de corriger le format acheté et le lieu de rangement, puis ajoute les quantités aux réserves dans une seule sauvegarde.
- « Mes réserves » et la liste d’épicerie affichent toutes les commandes en attente, indépendamment de la période de courses. Une livraison peut être prévue plusieurs mois plus tard; sa date peut être reportée et une date dépassée reste en attente de confirmation. Les articles et quantités commandés sont consultables sur place.
- Une commande en ligne reste en attente jusqu’à confirmation. Sa date doit précéder ou correspondre au repas pour couvrir son besoin. La reporter ou annuler son suivi recalcule les besoins, sans agir chez l’épicier.
- Les imports peuvent conserver les marques, les formats, les prix des lignes et un créneau de livraison. Plusieurs formats du même ingrédient gardent des lignes distinctes; les articles hors catalogue restent des aliments personnels sans valeurs nutritionnelles inventées. Un format inconnu reste en pièces ou paquets, sans conversion supposée en grammes.
- La réception clôture une commande et ajoute les quantités réellement reçues. Une quantité de zéro signale un article absent, qui redevient à acheter. Une seconde confirmation de la même réception ne rajoute rien.
- « J’ai cuisiné » demande les portions préparées et montre les quantités à retirer. Les quantités non suivies sont signalées, jamais remplacées par un stock négatif. Annuler une préparation rétablit seulement ses mouvements, sans écraser les changements de stock ultérieurs.
- Dans chaque page du journal, « Mes repas du jour » reprend les recettes planifiées à cette date. La case « Fait » ouvre la même confirmation des portions que « J’ai cuisiné ». Son état est partagé avec le planificateur et n’est coché qu’après la sauvegarde de la préparation. Décocher annule les déductions. Le texte du journal continue de s’enregistrer séparément.
- Un repas cuisiné ne peut pas être remplacé avant l’annulation de sa préparation. Les commandes passées conservent leur contenu si le menu change.

Les épiciers préférés sont enregistrés dans les préférences. L’ouverture de leur boutique et la copie de la liste ne passent aucune commande et ne transmettent aucun panier automatiquement. L’utilisateur confirme séparément les achats qu’il a effectués.

## Confidentialité et concurrence

`shopping` est un ajout facultatif au document personnel existant : commandes, épiciers, cases et préparations suivent les mêmes règles d’isolation et de chiffrement que le journal et les réserves. Aucun nouveau droit administrateur ni table publique n’est ajouté.

Les opérations de stock et leur état sont enregistrés atomiquement par `save_standard_workspace`, ou dans une seule enveloppe chiffrée. Les révisions refusent les écritures provenant d’une page périmée; les identifiants d’opération évitent de rejouer une réception ou une préparation. Aucun contenu de courses n’est enregistré dans les journaux serveur.

Les tests `shopping.spec.ts`, `shopping-persistence.spec.ts` et `privacy.spec.ts` couvrent les périodes qui se chevauchent, livraisons tardives/partielles, unités, déductions/annulations, doubles confirmations, sauvegarde/relecture et refus interutilisateur, y compris administrateur.

## Disponibilité et décongélation

Les noms d’épiciers affichés dans la liste proviennent uniquement des commandes qui contribuent au besoin. Un épicier préféré ne devient pas une preuve d’achat. Les ingrédients déjà couverts sont cochés et masqués par défaut; ils réapparaissent avec « Déjà couverts ». Un format de commande incompatible avec l’unité de recette reste explicitement à vérifier, hors des achats automatiques, sans promettre une quantité suffisante.

Le rond vert du repas exige une couverture complète de chaque ingrédient obligatoire. Le rond rouge détaille les manquants ou les quantités à vérifier. Le même calcul réserve le stock chronologiquement dans les menus et les courses; une livraison dont le créneau se termine après le repas ne le couvre pas. Les explications fonctionnent au survol, au clavier et au toucher.

Le menu « … → Déjà en réserve » ajoute la quantité réellement présente, son rangement et une note, avec les préférences d’unités. Sur mobile et écran tactile, un bouton rond avec un réfrigérateur ouvre directement ce formulaire. La mesure initiale est « Volume », dans l’unité choisie par l’utilisateur; la quantité reste vide pour saisir le stock réel sans convertir arbitrairement le poids demandé par une recette. Les autres mesures restent disponibles. Le congélateur indique explicitement que l’aliment est congelé.

Les fenêtres de courses suivent la zone visible du navigateur lorsque le clavier s’ouvre et gardent le champ actif accessible par défilement interne. Les champs tactiles utilisent une police de 16 px, sans désactiver le zoom manuel. `grocery-mobile.spec.ts` couvre les petits écrans, le paysage, le clavier simulé, les unités et l’ajout aux réserves.

Dans « Mes réserves », l’ajout et la modification utilisent la même fenêtre adaptée au clavier. Un nouvel aliment propose « Volume » par défaut. Le champ de quantité demande un clavier décimal; une modification reprend l’unité et la valeur enregistrées sans les réinitialiser. Les erreurs s’affichent dans le formulaire et conservent les saisies. `pantry-mobile.spec.ts` vérifie l’ajout, la modification, l’annulation, les petites tailles d’écran et le clavier simulé.

Les rappels de décongélation sont calculés localement, y compris pour un espace chiffré. Les réserves montrent les prochaines décongélations; un avis apparaît partout dans l’application dans les 24 heures précédant le repas. Repères horaires Toronto : 8 h / 10 h / 12 h / 15 h / 18 h / 21 h. La durée de décongélation nécessaire dépend du format; ce rappel n’est pas une garantie sanitaire. « Mis au réfrigérateur » déplace uniquement la quantité indiquée, sans la consommer; l’opération est idempotente et le frais est utilisé avant le congelé.

Les avis restent uniquement dans Iamable, conformément au choix du propriétaire : aucun envoi externe ni rappel calendrier. Ils apparaissent lors de l’ouverture de l’application ou automatiquement pendant qu’elle est ouverte, pendant les 24 heures précédant le repas, avec recalcul lors des changements de stock ou de menu.

## Réserves compactes et unités comptées

Mes réserves reprend les rayons de l’épicerie, indépendamment de l’emplacement. Chaque ligne conserve son emplacement, sa quantité et ses actions. Le bouton « Ajouter un aliment personnel » permet de créer un aliment sans recette et de choisir son rayon; ce rayon facultatif est conservé dans les données personnelles, y compris le coffre chiffré. Les aliments épuisés restent accessibles par le filtre dédié.

Un ingrédient déjà en réserve ouvre d’abord ses entrées existantes depuis la liste d’épicerie. « Modifier cette réserve » conserve son identifiant; l’ajout d’un autre lot est explicite. Une quantité non comparable affiche la quantité enregistrée et un lien de correction, plutôt qu’un avertissement ambigu.

Pour l’ail frais, les unités gousses et têtes sont explicites : 3 g par gousse et 24 g par tête, selon [Santé Canada, FCÉN, aliment 2394](https://food-nutrition.canada.ca/cnf-fce/serving-portion?id=2394). Le besoin de la recette utilise son équivalent en grammes documenté. Les conversions sont estimées; des unités sans libellé ou des paquets ne sont jamais convertis automatiquement. La même conversion sert aux courses, à la disponibilité des repas et à « J’ai cuisiné », avec une annulation exacte des déductions.

## Aliments personnels et sélections

« Ajouter un aliment » ajoute un besoin d’achat indépendant des recettes et des dates affichées. Son rayon et sa quantité restent dans les données privées. Une commande en attente couvre la quantité commandée, mais n’augmente pas les réserves. La réception conserve le rayon, ajoute seulement la quantité reçue et laisse le solde à acheter. Une annulation remet le besoin dans la liste; une confirmation répétée n’ajoute pas deux fois le stock. Les achats terminés restent accessibles dans « Déjà couverts »; consommer ensuite le stock ne relance pas automatiquement cet achat.

Les coches réagissent immédiatement. Une file sérialise et regroupe les écritures en conservant le dernier choix de chaque article. Les autres cases restent utilisables pendant une sauvegarde. En cas d’échec, les choix sont conservés à l’écran avec une action « Réessayer »; ils ne sont pas présentés comme enregistrés. « Tout sélectionner » ne sélectionne que les articles à acheter.

Les épiciers et les commandes restent gérés manuellement : copie de liste, ouverture de la boutique, puis confirmation d’achat ou de réception dans Tred’meal. Aucun export de panier ni connexion Instacart n’est proposé.

Les listes déroulantes utilisent un composant commun aux couleurs de l’application, placé au-dessus de la fenêtre et ajusté à l’écran. Navigation au clavier, recherche par frappe et touche Échap sont disponibles. Les champs mobiles conservent leur police de 16 px et le clavier décimal.

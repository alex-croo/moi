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

Le menu « … → Déjà en réserve » ajoute la quantité réellement présente, son rangement et une note, avec les préférences d’unités. Le congélateur indique explicitement que l’aliment est congelé.

Les rappels de décongélation sont calculés localement, y compris pour un espace chiffré. Les réserves montrent les prochaines décongélations; un avis apparaît partout dans l’application dans les 24 heures précédant le repas. Repères horaires Toronto : 8 h / 10 h / 12 h / 15 h / 18 h / 21 h. La durée de décongélation nécessaire dépend du format; ce rappel n’est pas une garantie sanitaire. « Mis au réfrigérateur » déplace uniquement la quantité indiquée, sans la consommer; l’opération est idempotente et le frais est utilisé avant le congelé.

Les avis restent uniquement dans Iamable, conformément au choix du propriétaire : aucun envoi externe ni rappel calendrier. Ils apparaissent lors de l’ouverture de l’application ou automatiquement pendant qu’elle est ouverte, pendant les 24 heures précédant le repas, avec recalcul lors des changements de stock ou de menu.

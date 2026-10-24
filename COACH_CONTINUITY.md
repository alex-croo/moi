# Marie : continuité du journal

## Constat du 24 octobre 2026

La génération du compte propriétaire fonctionnait : une introduction et une question étaient enregistrées pour la journée. Mais le mot de Marie était placé sous le titre de la lecture, et le suivi après l’écriture libre. Une génération absente supprimait totalement l’introduction. Les sept dernières journées étaient transmises sans sélection d’un concept à revisiter; aucun repère durable n’était confirmé sur ce compte.

## Parcours retenu

1. Marie ouvre la page avec son avatar et un mot bref. En cas d’attente ou d’indisponibilité, son emplacement reste visible et propose une reprise explicite.
2. Un rappel facultatif porte sur une lecture réellement terminée, distincte de celle du jour. La personne peut retrouver l’idée de mémoire, ouvrir l’explication ou rouvrir sa page d’origine. Sa réponse se sauvegarde comme les autres notes.
3. Une transition relie ce repère au thème actuel. La lecture approuvée et ses références restent intactes.
4. Un petit essai concret est rattaché à un contexte quotidien, avec une possibilité d’ajustement. Une intention passée n’est jamais présentée comme un comportement accompli.
5. Une seule question de suivi est mise en avant après la lecture. Les questions précédentes restent accessibles. Le journal libre et les rappels pratiques restent dans la même page.
6. Les repères proposés peuvent être gardés ou refusés dans la page. Seuls les repères confirmés servent de mémoire durable.

L’ouverture est stable après génération : actualiser ou revenir sur la page ne crée pas une nouvelle question. Une demande explicite peut ensuite prendre en compte les dernières notes. L’option d’écriture libre, le consentement, une seule étape par date locale, les brouillons, les révisions et l’isolation entre propriétaires restent applicables.

## Appuis scientifiques et limites de transposition

- **Rappel actif espacé** : Karpicke & Bauernschmidt (2011), expérimentation sur la rétention. Espacer les tentatives de rappel améliore la mémorisation; aucun calendrier relatif unique n’était supérieur. Application : une question avant d’afficher l’explication. Les repères de 1, 3, 7, 14 ou 30 jours sont des choix produit, modulés par la pertinence et les rappels récents, pas un protocole clinique validé. https://pubmed.ncbi.nlm.nih.gov/21574747/
- **Répétition dans un contexte stable** : Diefenbacher et al. (2023), étude sur les habitudes de consommation de fruits. Application : relier une petite action à une situation réelle puis observer ce qui a aidé. Ce résultat ne démontre pas l’efficacité d’un journal IA ni une perte de poids. https://discovery.ucl.ac.uk/id/eprint/10160769/1/Lally_British%20J%20Health%20Psychol%20-%202022%20-%20Diefenbacher%20-%20Habit%20formation%20in%20context%20%20Contextspecific%20and%20contextfree%20measures%20for.pdf
- **Autonomie et compétence** : Sheeran et al. (2020), méta-analyse de 65 tests d’interventions issues de la théorie de l’autodétermination. Effets moyens faibles sur les comportements de santé. Application : choix, possibilité de passer une question, ajustement sans culpabilisation. https://pubmed.ncbi.nlm.nih.gov/32437175/
- **Une intention ne suffit pas** : Carrera et al. (2018), essai randomisé auprès de 877 personnes; planifier simplement des séances n’a pas augmenté la fréquentation. Application : suivre ce qui s’est réellement passé, les contraintes et les ajustements, sans promettre qu’un plan forme automatiquement une habitude. https://pmc.ncbi.nlm.nih.gov/articles/PMC7872013/

Ces choix visent à soutenir apprentissage et autonomie. La rétention d’une idée, une visite de l’application et une habitude durable sont des résultats différents. Pas de série punitive ni de promesse de délai universel. Une évaluation ultérieure doit privilégier les essais rapportés et leur utilité perçue, pas seulement les ouvertures de page; aucun traçage supplémentaire n’est ajouté ici.

## Contexte et garanties

Le serveur vérifie le consentement et l’accès Fireworks avant de charger les textes. Il sélectionne au plus quatre extraits récents, quatre journées de notes, dix repères confirmés et une lecture passée parmi 45 journées. Les données futures et les repères non confirmés sont exclus. Le titre et la date du rappel sont validés contre les journées du propriétaire. Une question ou un exercice généré n’est pas un fait autobiographique.

Aucune modification de la politique Fireworks ni du modèle Ember-1. Les requêtes utilisent `store:false`, un schéma de sortie et des délais bornés. Le verrou de rétention des comptes non pilotes et le consentement restent actifs. Les échecs libèrent la requête en cours; la limite quotidienne reste quatre tentatives. Un retour tardif ne remplace pas une note plus récente. Les textes privés ne figurent pas dans les journaux techniques ni dans les tests de fournisseur.

## Suivi du petit pas et fil unique (24 octobre, version 3)

Le contexte relie chaque proposition récente à sa date, aux réponses avec leur
question d’origine et aux mots du journal. Une proposition n’atteste jamais un
résultat. Marie reprend l’essai le plus récent, reconnaît seulement ce qui a été
rapporté et ajuste le geste, notamment s’il n’a pas été essayé. Son enseignement
reste fondé sur la lecture approuvée et ses références.

La page présente une introduction, l’enseignement contextualisé, un seul petit
pas et une seule invitation au journal libre. Les anciennes réponses restent
accessibles sous « Mes notes déjà écrites »; aucune n’est effacée. Les suggestions
de mémoire et l’actualisation volontaire sont dans des options repliées. Les
questions identiques ou très proches sont supprimées avant persistance; SQL
empêche aussi la duplication exacte. Le rechargement conserve le même fil et la
limite d’une nouvelle étape par jour reste inchangée.

La préparation utilise deux appels parallèles : le fil personnel reçoit les
notes autorisées, tandis que l’enseignement reçoit uniquement le titre et le
texte des lectures approuvées, actuelle et précédente. Cette séparation évite
que l’anecdote personnelle soit racontée une seconde fois dans la lecture ou
que des indications éditoriales internes apparaissent dans la page. Les deux
résultats sont validés puis enregistrés ensemble; une réponse partielle ne
remplace pas la journée existante.

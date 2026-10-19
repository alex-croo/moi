import type { ProgramProgress } from "./private-types";
export const PROGRAM_VERSION = "premiers-pas-v1";
export const programSources = {
  habits: {
    label: "NIDDK · Changing your habits",
    url: "https://www.niddk.nih.gov/health-information/diet-nutrition/changing-habits-better-health",
  },
  cues: {
    label: "NIH · Creating healthy habits",
    url: "https://newsinhealth.nih.gov/2018/03/creating-healthy-habits",
  },
  thoughts: {
    label: "NHS · Reframing unhelpful thoughts",
    url: "https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/reframing-unhelpful-thoughts/",
  },
  food: {
    label: "Santé Canada · Guide alimentaire",
    url: "https://www.canada.ca/en/health-canada/services/food-guide/explore/healthy-eating-recommendations.html",
  },
  movement: {
    label: "CDC · Benefits of physical activity",
    url: "https://www.cdc.gov/physical-activity-basics/benefits/",
  },
  sleep: {
    label: "CDC · Sleep and heart health",
    url: "https://www.cdc.gov/heart-disease/about/sleep-and-heart-health.html",
  },
  weight: {
    label: "NIDDK · Factors affecting weight and health",
    url: "https://www.niddk.nih.gov/health-information/weight-management/adult-overweight-obesity/factors-affecting-weight-health",
  },
};
type Pair = [string, string];
export type Lesson = {
  id: string;
  day: number;
  title: Pair;
  body: Pair;
  action: Pair;
  question: Pair;
  source: keyof typeof programSources;
};
// Original educational exercises. Sources support the short background principle,
// not a claim that this particular 31-day program has been clinically validated.
const rows: [Pair, Pair, Pair, Pair, keyof typeof programSources][] = [
  [
    ["Un départ qui vous ressemble", "A beginning that feels like you"],
    [
      "Un changement peut commencer par une raison personnelle. Aujourd’hui, imaginez une scène ordinaire que vous aimeriez vivre avec plus d’aisance : préparer un repas sans vous sentir pressé, profiter d’une sortie, prendre un moment pour vous.\n\nDans ce programme, vous choisissez ce qui mérite votre attention. Il n’y a pas de poids à atteindre pour réussir une journée. Votre première page peut tenir en trois lignes : ce qui compte, ce qui semble difficile, et ce que vous êtes prêt à essayer. Vous pourrez changer d’avis en apprenant à vous connaître.",
      "Change can begin with a personal reason. Imagine an ordinary scene you would like to experience with more ease: preparing a meal without rushing, enjoying an outing, making time for yourself.\n\nYou choose what deserves your attention here. There is no target weight to reach to complete a day. Your first page can be three lines: what matters, what feels difficult, and what you are willing to try. You can change your mind as you learn about yourself.",
    ],
    [
      "Choisissez une raison qui vous appartient.",
      "Choose a reason that belongs to you.",
    ],
    [
      "Qu’aimerais-je rendre plus agréable dans mon quotidien?",
      "What would I like to make more enjoyable in my everyday life?",
    ],
    "habits",
  ],
  [
    ["Observer sans se noter", "Notice without grading yourself"],
    [
      "Observer ses habitudes peut aider à comprendre leur contexte. Imaginez que vous décrivez votre journée à une personne bienveillante : à quelle heure avez-vous mangé, où étiez-vous, et comment vous sentiez-vous?\n\nUne observation comme « j’ai dîné entre deux réunions » ouvre des possibilités. « Je suis nul » n’indique pas quoi ajuster. Pour cet exercice, laissez les jugements de côté et recueillez un seul détail. Vous n’avez pas besoin de tout suivre ni de donner une note à chaque repas.",
      "Noticing habits can help reveal their context. Imagine describing your day to someone kind: when did you eat, where were you, and how did you feel?\n\nAn observation like “I ate lunch between meetings” opens possibilities. “I’m hopeless” does not identify what to adjust. Leave judgments aside and collect one detail. You do not need to track everything or grade each meal.",
    ],
    [
      "Décrivez un repas avec des faits simples.",
      "Describe one meal using simple facts.",
    ],
    [
      "Quel détail de ma journée m’aide à mieux me comprendre?",
      "What detail helps me understand my day better?",
    ],
    "habits",
  ],
  [
    ["Une action assez petite", "An action small enough to try"],
    [
      "Les petits changements peuvent servir de point de départ. Une intention immense peut être difficile à placer dans un mardi chargé. Une action précise a davantage de place : sortir un contenant pour le dîner ou choisir une recette pour demain.\n\nImaginez deux versions de votre action : celle d’une journée disponible, puis celle d’une journée occupée. Gardez la deuxième comme point de départ. Vous pourrez en faire davantage si vous en avez envie, sans transformer le minimum en nouvelle obligation.",
      "Small changes can offer a starting point. A huge intention may be hard to fit into a busy Tuesday. A specific action has a clearer place: setting out a lunch container or choosing tomorrow’s recipe.\n\nImagine two versions of your action: one for a spacious day, another for a busy one. Start with the second. You can do more if you want, without turning the minimum into another obligation.",
    ],
    [
      "Choisissez une action qui prend environ deux minutes.",
      "Choose an action that takes about two minutes.",
    ],
    [
      "Quel petit geste serait faisable même lors d’une journée chargée?",
      "What small step would fit even on a busy day?",
    ],
    "habits",
  ],
  [
    ["La faim, une information", "Hunger is information"],
    [
      "Le Guide alimentaire canadien invite à porter attention à la faim et au rassasiement. Ces sensations ne sont pas toujours évidentes; le contexte, certains médicaments et la santé peuvent les modifier.\n\nÀ votre prochain repas, prenez simplement un moment pour remarquer ce qui est présent : une sensation physique, une envie, de la fatigue, ou plusieurs choses à la fois. Il ne s’agit pas d’obtenir la permission de manger. Vous pouvez manger même quand les signaux sont flous et conserver les repères recommandés par votre professionnel de santé.",
      "Canada’s food guide encourages awareness of hunger and fullness. These sensations can be unclear; context, medicines and health can influence them.\n\nAt your next meal, notice what is present: a physical sensation, a craving, tiredness, or several things at once. This is not a test you must pass to eat. You can eat when signals are unclear and keep any eating schedule recommended by your health professional.",
    ],
    [
      "Faites une brève pause d’observation avant un repas.",
      "Take a brief moment to notice how you feel before a meal.",
    ],
    [
      "Qu’ai-je remarqué, sans chercher à contrôler la réponse?",
      "What did I notice without trying to control the answer?",
    ],
    "food",
  ],
  [
    ["Bouger à votre façon", "Movement your way"],
    [
      "L’activité physique peut soutenir le bien-être au-delà du poids. Votre version du mouvement peut être une promenade, une danse, un peu de jardinage ou un mouvement adapté en position assise.\n\nPour aujourd’hui, cherchez une expérience accessible et agréable plutôt qu’un chiffre à atteindre. Vous pouvez aussi choisir de vous reposer. Après l’essai, observez votre confort et votre énergie. Cet exercice n’invite pas à ignorer une douleur ou une limite médicale : adaptez-le à vos capacités et à vos conseils de soins.",
      "Physical activity can support well-being beyond body weight. Your version might be a walk, dancing, gardening or adapted seated movement.\n\nLook for something accessible and enjoyable rather than a number to reach. Rest can also be your choice. Afterwards, notice comfort and energy. This exercise does not ask you to ignore pain or medical limits: adapt it to your abilities and care advice.",
    ],
    [
      "Essayez un mouvement agréable et adapté, si vous le souhaitez.",
      "Try enjoyable, suitable movement if you want to.",
    ],
    [
      "Quel mouvement me fait du bien, et dans quelles conditions?",
      "What movement feels good to me, and under what conditions?",
    ],
    "movement",
  ],
  [
    ["Faire de la place au plaisir", "Make room for enjoyment"],
    [
      "Le plaisir et la culture ont leur place dans l’alimentation. Pensez à un repas que vous aimez vraiment : sa texture, son odeur, la personne avec qui vous le partagez.\n\nAujourd’hui, choisissez un détail à savourer. Il peut s’agir de la première bouchée d’un déjeuner ou d’un souper familier. Aucun aliment n’a besoin d’être transformé en récompense à mériter. Dans votre journal, décrivez l’expérience avec vos propres mots. Si le repas était pressé ou décevant, cela mérite aussi sa place.",
      "Enjoyment and culture have a place in eating. Think of a meal you love: its texture, smell, or the person you share it with.\n\nChoose one detail to enjoy today. It could be the first bite of breakfast or a familiar dinner. Food does not need to become a reward you must earn. Describe the experience in your own words. A rushed or disappointing meal also belongs in your journal.",
    ],
    [
      "Repérez un détail agréable dans un repas.",
      "Notice one enjoyable detail in a meal.",
    ],
    [
      "Qu’est-ce qui rend un repas satisfaisant pour moi?",
      "What makes a meal satisfying for me?",
    ],
    "food",
  ],
  [
    ["Premier jalon : j’observe", "First milestone: I notice"],
    [
      "Vous avez parcouru sept journées. Ce jalon reconnaît du temps consacré à vous comprendre, sans mesurer une transformation physique.\n\nRelisez une ou deux pages si vous en avez écrit. Recherchez quelque chose de concret : une préférence, un obstacle, un moment qui vous a fait du bien. Si votre journal est vide, partez simplement de votre souvenir. Choisissez ce que vous souhaitez emporter dans la suite. Vous pouvez garder ce jalon pour vous ou annoncer explicitement votre étape dans un cercle. Rien n’y est publié automatiquement.",
      "You have worked through seven days. This milestone recognizes time spent understanding yourself, without measuring physical change.\n\nReread a page or two if you wrote any. Look for something concrete: a preference, an obstacle, a moment that felt good. If your journal is empty, start with a memory. Choose what you want to carry forward. Keep this milestone private or explicitly share it in a circle. Nothing is posted automatically.",
    ],
    [
      "Nommez une découverte et un geste à conserver.",
      "Name one discovery and one step to keep.",
    ],
    [
      "Qu’ai-je appris sur moi pendant ces premières journées?",
      "What have I learned about myself so far?",
    ],
    "habits",
  ],
  [
    ["Le contexte compte", "Context matters"],
    [
      "Les habitudes sont liées à leur environnement. Pensez à l’endroit où une décision devient difficile : devant un frigo peu pratique, pendant un déplacement, entre deux obligations.\n\nPlutôt que de vous demander davantage d’efforts, imaginez une petite modification du décor. Un aliment utile plus visible, une bouteille accessible, une recette déjà choisie. L’objectif est de vous faciliter une décision qui vous convient. Une seule modification suffit pour l’expérience d’aujourd’hui.",
      "Habits are connected to their environment. Think of where a decision becomes difficult: an awkward fridge, a commute, competing commitments.\n\nInstead of asking yourself for more effort, imagine a small change to the setting. Useful food within reach, a bottle nearby, a recipe already chosen. The aim is to make a decision that suits you easier. One change is enough for today’s experiment.",
    ],
    [
      "Rendez un choix utile plus accessible.",
      "Make one useful choice easier to access.",
    ],
    [
      "Quel détail autour de moi pourrait me simplifier la vie?",
      "What detail around me could make life easier?",
    ],
    "cues",
  ],
  [
    ["Un repère qui existe déjà", "Use a cue you already have"],
    [
      "Un contexte répété peut servir de repère à une habitude. Choisissez un moment qui arrive déjà : poser vos clés, préparer votre café, terminer votre journée de travail.\n\nAccrochez-y une action courte qui vous convient. Par exemple, quand vous rangez votre tasse, vous regardez le repas prévu pour le soir. Essayez cette association une fois, puis observez. Si elle ne fonctionne pas, changez le repère; vous n’avez pas à insister sur une organisation qui ne correspond pas à votre vie.",
      "A repeated context can serve as a cue for a habit. Choose something that already happens: putting down your keys, making coffee, finishing work.\n\nAttach a short action that suits you. For example, when you put away your cup, you check the evening meal plan. Try the pairing once and observe. If it does not work, change the cue; you do not have to force an arrangement that does not fit your life.",
    ],
    [
      "Associez un petit geste à un moment existant.",
      "Pair a small step with an existing moment.",
    ],
    [
      "À quel moment mon geste trouverait-il naturellement sa place?",
      "When would my chosen step fit naturally?",
    ],
    "cues",
  ],
  [
    ["Sortir du tout ou rien", "Step beyond all or nothing"],
    [
      "Une pensée peut être examinée plutôt que prise pour un verdict. Après un repas différent du plan, « tout est gâché » raconte beaucoup plus qu’un événement précis.\n\nEssayez une formulation qui décrit ce qui s’est passé : « Ce repas était plus copieux que prévu. Je peux reprendre mon prochain repas habituel. » L’exercice ne consiste pas à vous forcer à penser positivement. Il s’agit de trouver une phrase juste, assez précise pour laisser une prochaine action possible.",
      "A thought can be examined rather than treated as a verdict. After a meal differs from your plan, “everything is ruined” says far more than one specific event.\n\nTry words that describe what happened: “That meal was larger than planned. I can return to my usual next meal.” This is not about forcing positive thoughts. It is about finding an accurate sentence that leaves room for a next step.",
    ],
    [
      "Reformulez une pensée absolue en observation précise.",
      "Rephrase an absolute thought as a specific observation.",
    ],
    [
      "Quelle phrase m’aide à agir sans me juger?",
      "What words help me act without judging myself?",
    ],
    "thoughts",
  ],
  [
    ["Un repas de secours", "A fallback meal"],
    [
      "Prévoir un obstacle peut rendre une action plus accessible. Imaginez un soir où le temps manque : quel repas familier demande peu de préparation avec ce que vous avez?\n\nVotre repas de secours n’a pas à impressionner. Il peut s’appuyer sur des restes conservés de façon sûre ou quelques ingrédients simples que vous aimez. Regardez vos réserves et choisissez une possibilité. L’idée est de prendre une décision maintenant pour que votre futur vous ait une option disponible.",
      "Planning for an obstacle can make an action easier. Imagine an evening with little time: what familiar meal takes little preparation with what you have?\n\nYour fallback meal does not need to impress. It might use safely stored leftovers or a few simple ingredients you enjoy. Look at your pantry and choose an option. Decide now so your future self has something available.",
    ],
    [
      "Choisissez un repas simple à garder en option.",
      "Choose one simple meal as a backup option.",
    ],
    [
      "Quel repas pourrait m’aider quand je manque de temps?",
      "What meal could help when I am short on time?",
    ],
    "habits",
  ],
  [
    ["Le repos a sa place", "Rest has a place"],
    [
      "Le sommeil contribue à la santé. Une soirée chargée ne devient pas paisible par une simple consigne, mais vous pouvez repérer un élément sur lequel vous avez prise.\n\nImaginez un petit signal de transition : fermer une tâche, préparer les affaires de demain, réduire une stimulation qui vous dérange. Choisissez ce qui correspond à votre horaire, y compris si vous travaillez la nuit. Observez l’expérience sans noter votre sommeil comme une performance. Des difficultés persistantes méritent un échange avec un professionnel de santé.",
      "Sleep contributes to health. A busy evening does not become peaceful on command, but you can identify one element you can influence.\n\nImagine a small transition cue: ending a task, preparing tomorrow’s things, reducing a stimulation that bothers you. Choose what fits your schedule, including night work. Notice the experience without grading sleep as a performance. Persistent difficulties deserve a conversation with a health professional.",
    ],
    [
      "Préparez une transition vers votre période de repos.",
      "Prepare a transition towards your rest period.",
    ],
    [
      "Qu’est-ce qui pourrait rendre mon repos un peu plus accessible?",
      "What could make rest a little more accessible?",
    ],
    "sleep",
  ],
  [
    ["Faire un peu moins de décisions", "Make fewer decisions"],
    [
      "Planifier peut aider à anticiper les obstacles. Aujourd’hui, observez une décision que vous refaites souvent. Peut-être cherchez-vous chaque matin quoi emporter pour dîner.\n\nChoisissez un seul point à préparer : deux repas dans le planificateur, un aliment à décongeler de façon sûre, une liste d’épicerie à consulter. Vous n’êtes pas obligé d’organiser toute la semaine. Un plan est utile s’il vous laisse aussi de la place pour changer d’envie ou accueillir un imprévu.",
      "Planning can help anticipate obstacles. Notice a decision you repeatedly face. Perhaps every morning you wonder what to bring for lunch.\n\nPrepare just one thing: two meals in the planner, food to thaw safely, a grocery list to check. You do not need to organize the whole week. A plan is useful when it also leaves room for a change of appetite or an unexpected event.",
    ],
    [
      "Préparez une décision qui revient souvent.",
      "Prepare one recurring decision.",
    ],
    [
      "Quelle décision aimerais-je ne pas avoir à reprendre demain?",
      "What decision would I prefer not to make again tomorrow?",
    ],
    "habits",
  ],
  [
    ["Deuxième jalon : je simplifie", "Second milestone: I simplify"],
    [
      "Vous voici au deuxième jalon. Faites un petit inventaire de ce qui allège votre quotidien : un repas familier, un objet mieux placé, une phrase moins dure envers vous.\n\nDistinguez ce qui vous aide de ce qui ressemble à une corvée de plus. Vous avez le droit d’abandonner une expérience qui ne vous convient pas. Pour la suite, retenez un appui concret et simplifiez une attente. Cette étape ne dépend ni d’une série parfaite de connexions ni d’un chiffre sur la balance.",
      "You have reached your second milestone. Take stock of what lightens your day: a familiar meal, a better-placed item, kinder words towards yourself.\n\nSeparate what helps from what feels like another chore. You may stop an experiment that does not suit you. Carry one useful support forward and simplify one expectation. This milestone does not depend on a perfect sign-in streak or a number on the scale.",
    ],
    [
      "Gardez un appui et retirez une complication.",
      "Keep one support and remove one complication.",
    ],
    [
      "Qu’est-ce qui est devenu un peu plus simple pour moi?",
      "What has become a little simpler for me?",
    ],
    "habits",
  ],
  [
    ["Une émotion, plusieurs besoins", "One emotion, several needs"],
    [
      "Une réaction peut être explorée avec curiosité. Après une journée intense, vous pouvez avoir envie de manger, de parler, de vous reposer, ou de plusieurs choses à la fois.\n\nCet exercice ne vous demande pas de remplacer un repas par une distraction. Il vous propose d’élargir les possibilités autour de votre besoin. Imaginez une petite liste personnelle : un souper, un appel, du silence, une douche, une pause. Vous restez libre de choisir ce qui vous soutient maintenant.",
      "A reaction can be explored with curiosity. After an intense day, you may want food, conversation, rest, or several things at once.\n\nThis exercise does not ask you to replace a meal with a distraction. It invites more options around your needs. Imagine a personal list: dinner, a call, quiet, a shower, a pause. You remain free to choose what supports you now.",
    ],
    [
      "Nommez une émotion et un besoin possible.",
      "Name an emotion and a possible need.",
    ],
    [
      "De quoi aurais-je besoin en ce moment, en plus ou autour de mon repas?",
      "What might I need right now, alongside or around my meal?",
    ],
    "thoughts",
  ],
  [
    ["Préparer les imprévus", "Plan for the unexpected"],
    [
      "Anticiper une difficulté peut aider à ajuster son plan. Choisissez un imprévu fréquent, puis écrivez deux lignes : « Si cela arrive… alors je pourrais… »\n\nPar exemple : si une réunion dépasse, je pourrais déplacer ma marche ou choisir une courte pause adaptée. Il ne s’agit pas d’une promesse rigide. Votre option de rechange peut être le repos, un repas simple ou le report d’une tâche. Un plan souple vous laisse décider lorsque la situation réelle se présente.",
      "Anticipating difficulty can help you adapt a plan. Choose a common disruption and write two lines: “If this happens… then I could…”\n\nFor example: if a meeting runs late, I could move my walk or choose a short suitable break. This is not a rigid promise. Your alternative might be rest, a simple meal or postponing a task. A flexible plan leaves you free to decide when the real situation arrives.",
    ],
    [
      "Écrivez un scénario et une option de rechange.",
      "Write one scenario and one alternative.",
    ],
    [
      "Quel plan B respecterait mes besoins?",
      "What backup plan would respect my needs?",
    ],
    "habits",
  ],
  [
    ["Partager un repas", "Share a meal"],
    [
      "Manger avec d’autres fait partie des recommandations du Guide alimentaire. Les repas partagés peuvent aussi soulever des attentes ou des commentaires que vous n’aimez pas.\n\nImaginez une sortie qui vous plaît. Que souhaitez-vous y retrouver : une conversation, un plat, une occasion de vous retrouver? Préparez une phrase si vous voulez garder votre parcours privé, par exemple « Je préfère qu’on parle d’autre chose que de mon poids. » Vous choisissez vos limites, sans avoir à expliquer tout votre programme.",
      "Eating with others is included in Canada’s food guide recommendations. Shared meals can also bring expectations or comments you do not enjoy.\n\nImagine an outing you would like. What do you hope to find: conversation, a dish, time together? Prepare a sentence if you want privacy, such as “I’d rather talk about something other than my weight.” You choose your boundaries without explaining your whole program.",
    ],
    [
      "Choisissez ce que vous souhaitez apprécier lors d’un repas partagé.",
      "Choose what you want to enjoy about a shared meal.",
    ],
    [
      "De quoi ai-je besoin pour me sentir bien à table avec les autres?",
      "What helps me feel comfortable eating with others?",
    ],
    "food",
  ],
  [
    ["La balance dans son contexte", "Weight in context"],
    [
      "Le poids est influencé par de nombreux facteurs, dont la santé, l’environnement et certains médicaments. Un chiffre ne décrit pas toute une personne.\n\nSi vous choisissez de suivre votre poids, demandez-vous quelle place ce suivi prend dans votre journée. Vous pouvez aussi choisir de ne pas vous peser. Notez un autre élément qui compte pour vous : votre confort, votre énergie, la facilité à préparer un repas. Les décisions médicales et les objectifs de poids personnalisés se discutent avec un professionnel qui connaît votre situation.",
      "Weight is influenced by many factors, including health, environment and some medicines. A number does not describe a whole person.\n\nIf you choose to track weight, notice the place tracking takes in your day. You can also choose not to weigh yourself. Name another thing that matters: comfort, energy, ease in preparing a meal. Medical decisions and personal weight targets belong in a discussion with a professional who knows your situation.",
    ],
    [
      "Choisissez un repère de bien-être qui ne dépend pas du poids.",
      "Choose a well-being marker that does not depend on weight.",
    ],
    [
      "Comment ai-je envie de suivre mon parcours sans me réduire à un chiffre?",
      "How do I want to follow my journey without reducing myself to a number?",
    ],
    "weight",
  ],
  [
    ["Demander le bon soutien", "Ask for useful support"],
    [
      "Le soutien peut prendre plusieurs formes. La personne qui vous aime ne sait pas forcément ce qui vous aide : des conseils, une présence, une invitation à marcher ou simplement de l’écoute.\n\nPréparez une demande précise : « J’aimerais que tu m’écoutes sans chercher de solution » ou « Est-ce qu’on pourrait choisir un repas ensemble? » Dans vos cercles, vous pouvez partager un encouragement sans dévoiler votre journal. Le partage reste un choix, et le silence ne signifie pas un manque d’engagement.",
      "Support can take different forms. Someone who cares about you may not know what helps: advice, company, an invitation to walk or simply listening.\n\nPrepare a specific request: “I’d like you to listen without trying to solve it” or “Could we choose a meal together?” In your circles, you can share encouragement without revealing your journal. Sharing remains a choice, and silence does not mean a lack of commitment.",
    ],
    [
      "Formulez une demande de soutien concrète.",
      "Write a specific request for support.",
    ],
    [
      "Quel soutien me ferait du bien, et quelle limite voudrais-je préserver?",
      "What support would help, and what boundary would I like to keep?",
    ],
    "habits",
  ],
  [
    ["Parler autrement à soi-même", "Speak differently to yourself"],
    [
      "Examiner une pensée peut ouvrir une interprétation plus équilibrée. Imaginez qu’une personne proche vous décrit exactement la même journée que la vôtre. Quels mots choisiriez-vous?\n\nÉcrivez d’abord la phrase dure qui vous vient, si vous le souhaitez. Puis proposez une réponse réaliste, sans exagérer le positif : « J’étais fatigué et j’ai improvisé. Je peux préparer une option pour demain. » Votre réponse n’a pas à vous convaincre immédiatement. Vous essayez seulement une autre façon de raconter les faits.",
      "Examining a thought can make room for a more balanced interpretation. Imagine someone close describes exactly the same day as yours. What words would you choose?\n\nWrite the harsh sentence if you wish. Then offer a realistic response without exaggerating the positive: “I was tired and improvised. I can prepare an option for tomorrow.” It does not have to convince you immediately. You are trying another way to describe the facts.",
    ],
    [
      "Écrivez une réponse que vous pourriez offrir à un ami.",
      "Write a response you could offer a friend.",
    ],
    [
      "Quels mots seraient à la fois vrais et bienveillants?",
      "What words would be both accurate and kind?",
    ],
    "thoughts",
  ],
  [
    ["Troisième jalon : j’ajuste", "Third milestone: I adapt"],
    [
      "Trois jalons ne signifient pas que tout est devenu automatique. Vous avez maintenant plusieurs expériences à comparer.\n\nChoisissez une situation qui revient et regardez ce qui a changé : avez-vous une option de plus, une limite mieux nommée, une attente plus réaliste? Vous pouvez décider de ralentir, de reprendre une lecture ou de continuer. Pour ce bilan, écrivez une chose à garder, une chose à ajuster et une question encore ouverte. Les questions font partie du parcours.",
      "Three milestones do not mean everything is automatic. You now have several experiences to compare.\n\nChoose a recurring situation and notice what changed: one more option, a clearer boundary, a more realistic expectation? You can slow down, revisit a reading or continue. Write one thing to keep, one thing to adjust and one question still open. Questions belong in the journey.",
    ],
    ["Faites un bilan en trois lignes.", "Write a three-line reflection."],
    [
      "Qu’ai-je envie de garder, d’ajuster et de mieux comprendre?",
      "What do I want to keep, adjust and understand better?",
    ],
    "habits",
  ],
  [
    ["Quand rien ne semble changer", "When nothing seems to change"],
    [
      "Un changement de poids ne suit pas toujours les attentes. La situation personnelle, la santé et les traitements comptent; diminuer davantage son alimentation n’est pas une réponse automatique.\n\nPour aujourd’hui, revenez à une observation concrète de votre routine. Qu’est-ce qui vous soutient? Qu’est-ce qui vous coûte trop d’énergie? Si l’absence de changement vous inquiète, notez vos questions pour un professionnel. Vous n’avez pas besoin de décider seul d’une restriction ou de modifier un médicament pour prouver vos efforts.",
      "Weight change does not always match expectations. Personal circumstances, health and treatment matter; eating less is not an automatic answer.\n\nReturn to one concrete observation about your routine. What supports you? What takes too much energy? If a lack of change worries you, write questions for a professional. You do not need to decide on restriction alone or change a medicine to prove your effort.",
    ],
    [
      "Écrivez une observation et, si besoin, une question à poser.",
      "Write an observation and, if needed, a question to ask.",
    ],
    [
      "De quelle information ou de quel accompagnement aurais-je besoin?",
      "What information or support would help me now?",
    ],
    "weight",
  ],
  [
    ["Reprendre sans se punir", "Return without punishment"],
    [
      "Un contretemps ne signifie pas la fin d’un changement. Pensez à la différence entre reprendre une habitude et essayer de rembourser une journée passée.\n\nVotre prochaine action peut être ordinaire : prendre votre repas habituel, regarder votre plan, ouvrir votre journal. Elle n’a pas à être plus intense pour compenser. Si vous avez laissé le programme de côté, vous reprenez là où vous étiez. Les jours absents ne deviennent pas une liste de devoirs à rattraper.",
      "A setback does not have to end a change. Consider the difference between returning to a habit and trying to repay a past day.\n\nYour next action can be ordinary: eating your usual meal, looking at your plan, opening your journal. It does not need to be more intense to compensate. If you stepped away from this program, you return where you left off. Missed days do not become homework to catch up on.",
    ],
    [
      "Choisissez une prochaine action ordinaire.",
      "Choose one ordinary next action.",
    ],
    [
      "À quoi ressemble une reprise douce et concrète pour moi?",
      "What would a gentle, concrete return look like for me?",
    ],
    "habits",
  ],
  [
    ["Des réserves qui vous ressemblent", "A pantry that fits your life"],
    [
      "Cuisiner et prévoir ses repas font partie des repères alimentaires canadiens. Vos réserves peuvent être organisées autour de vos repas familiers, de votre budget et de votre espace.\n\nOuvrez votre liste de réserves et choisissez un ingrédient que vous oubliez souvent. Vérifiez ce que vous avez réellement et sa conservation, puis corrigez la quantité. Cette petite vérification peut guider votre prochaine liste d’épicerie. Vous n’avez pas besoin d’un garde-manger parfait pour préparer un repas qui vous convient.",
      "Cooking and meal planning are part of Canadian food guidance. Your pantry can be organized around familiar meals, budget and space.\n\nOpen your pantry list and choose one ingredient you often forget. Check what you actually have and its storage, then update the quantity. This small check can guide your next grocery list. You do not need a perfect pantry to make a meal that suits you.",
    ],
    [
      "Mettez à jour une réserve utile pour votre prochain repas.",
      "Update one pantry item useful for your next meal.",
    ],
    [
      "Quels aliments m’aident à cuisiner simplement?",
      "Which foods help me cook simply?",
    ],
    "food",
  ],
  [
    ["Changer le décor, garder le repère", "New setting, familiar cue"],
    [
      "Un changement de contexte peut modifier une habitude. Une fin de semaine ailleurs, un horaire différent ou une visite suffit parfois à déplacer vos repères.\n\nChoisissez une version transportable d’un geste qui vous aide. Votre pause journal peut devenir une phrase; votre préparation de repas, le choix d’une option accessible sur place. Il ne s’agit pas de reproduire parfaitement la maison. Vous cherchez ce qui peut rester utile dans la situation nouvelle.",
      "A change of context can affect a habit. A weekend away, a different schedule or visitors can shift your usual cues.\n\nChoose a portable version of a useful step. Your journal time might become one sentence; meal preparation might become choosing an available option nearby. The aim is not to reproduce home perfectly. Look for what remains useful in the new setting.",
    ],
    [
      "Imaginez une version souple de votre routine ailleurs.",
      "Imagine a flexible version of your routine elsewhere.",
    ],
    [
      "Quel repère aimerais-je emporter avec moi?",
      "What cue would I like to bring with me?",
    ],
    "cues",
  ],
  [
    ["L’énergie avant la performance", "Energy before performance"],
    [
      "L’activité physique a des bénéfices qui dépassent la dépense d’énergie. Aujourd’hui, regardez votre mouvement à travers une autre question : quelle expérience aimeriez-vous vivre?\n\nUne sortie pour prendre l’air, un étirement confortable ou un moment de jeu peuvent avoir des sens différents. Choisissez une activité adaptée et une durée qui respecte vos possibilités. Si votre corps demande du repos, accueillez cette information. Le journal peut garder la trace de votre expérience, sans transformer le mouvement en dette liée à un repas.",
      "Physical activity has benefits beyond energy expenditure. Consider movement through another question: what experience would you like?\n\nFresh air, a comfortable stretch or a moment of play can mean different things. Choose something suitable and a duration that respects your abilities. If your body needs rest, notice that information. Your journal can record the experience without turning movement into a debt attached to food.",
    ],
    [
      "Choisissez une intention agréable pour votre mouvement ou votre repos.",
      "Choose an enjoyable intention for movement or rest.",
    ],
    [
      "Comment voudrais-je me sentir pendant cette activité?",
      "How would I like to feel during this activity?",
    ],
    "movement",
  ],
  [
    ["Apprendre d’une journée difficile", "Learn from a difficult day"],
    [
      "Une pensée difficile peut être observée et questionnée. Choisissez un événement assez léger pour en parler maintenant; vous n’avez pas à revisiter une situation pénible dans cette application.\n\nÉcrivez trois lignes séparées : les faits, ce que vous avez pensé, et ce dont vous auriez eu besoin. Cette séparation peut faire apparaître une question utile. Vous pouvez aussi arrêter l’exercice et choisir une page libre. Votre journal n’a pas à résoudre chaque difficulté pour avoir de la valeur.",
      "A difficult thought can be noticed and questioned. Choose an event that feels manageable now; you do not need to revisit a distressing situation in this app.\n\nWrite three separate lines: the facts, what you thought, and what you needed. Separating them may reveal a useful question. You can also stop and choose a free-writing page. Your journal does not need to solve every difficulty to be worthwhile.",
    ],
    [
      "Distinguez les faits, votre pensée et votre besoin.",
      "Separate the facts, your thought and your need.",
    ],
    [
      "Qu’est-ce que cette journée m’apprend sur mes besoins?",
      "What does this day teach me about my needs?",
    ],
    "thoughts",
  ],
  [
    ["Reconnaître ce qui tient", "Recognize what is holding"],
    [
      "Une routine se construit avec le temps. Repensez à un geste qui vous demande un peu moins de préparation qu’au début, même s’il reste irrégulier.\n\nDécrivez précisément ce qui l’aide à tenir : son moment, les personnes autour, le matériel disponible ou sa simplicité. Cette description vous donnera quelque chose à retrouver après une interruption. Si aucun geste ne vous vient, repérez plutôt une attente que vous avez assouplie. Cela peut aussi faire partie de votre apprentissage.",
      "A routine develops over time. Think of a step that takes a little less preparation than before, even if it is still irregular.\n\nDescribe what helps it hold: timing, people around you, available materials or simplicity. This description gives you something to return to after an interruption. If no step comes to mind, notice an expectation you have softened. That can also be part of learning.",
    ],
    [
      "Décrivez les conditions d’un geste qui vous aide.",
      "Describe the conditions behind a helpful step.",
    ],
    [
      "Qu’est-ce que je peux retrouver quand ma routine change?",
      "What can I return to when my routine changes?",
    ],
    "cues",
  ],
  [
    ["Votre rythme vous appartient", "Your pace belongs to you"],
    [
      "Les parcours de poids et de santé sont influencés par des facteurs différents. Comparer deux résultats sans connaître leur contexte laisse beaucoup d’informations de côté.\n\nDans un cercle, vous pouvez recevoir de l’encouragement sans entrer dans une compétition. Préparez votre propre définition d’une prochaine étape : une lecture, une demande d’aide, une recette essayée, une limite respectée. Si une comparaison vous met sous pression, vous pouvez prendre du recul et choisir ce que vous partagez.",
      "Weight and health journeys are influenced by different factors. Comparing two outcomes without their context leaves out much of the picture.\n\nIn a circle, you can receive encouragement without competing. Define your own next step: a reading, asking for help, trying a recipe, respecting a boundary. If comparison creates pressure, you can step back and choose what you share.",
    ],
    [
      "Définissez une prochaine étape qui ne dépend que de votre parcours.",
      "Define a next step that belongs to your own journey.",
    ],
    [
      "Comment reconnaître mes progrès sans me comparer?",
      "How can I recognize progress without comparing myself?",
    ],
    "weight",
  ],
  [
    ["Préparer la suite", "Prepare what comes next"],
    [
      "Revoir son plan fait partie d’un changement d’habitudes. Vous n’avez pas besoin d’ajouter une nouvelle règle à chaque étape.\n\nChoisissez trois éléments pour votre prochaine période : un geste à poursuivre, une option de secours et une personne ou une ressource à solliciter si nécessaire. Donnez-vous une date pour relire cette page, sans en faire un examen. Votre plan peut rester court et évoluer lorsque vos contraintes changent.",
      "Reviewing a plan is part of changing habits. You do not need a new rule at every stage.\n\nChoose three elements for your next period: a step to continue, a backup option and a person or resource to approach if needed. Choose a date to reread this page without making it an exam. Your plan can stay short and change as your circumstances do.",
    ],
    [
      "Écrivez votre petit plan pour la suite.",
      "Write your small plan for what comes next.",
    ],
    [
      "Qu’ai-je envie de poursuivre, et de quel soutien aurai-je besoin?",
      "What do I want to continue, and what support might I need?",
    ],
    "habits",
  ],
  [
    ["Quatrième jalon : je continue", "Fourth milestone: I continue"],
    [
      "Vous arrivez au terme de ces 31 journées. Ce jalon marque un parcours de lectures et d’expériences; il ne promet pas un résultat physique ni une habitude définitivement acquise.\n\nRelisez votre raison de départ, puis écrivez ce que vous souhaitez garder aujourd’hui. Elle a peut-être changé. Le journal, les menus et les cercles restent disponibles, et vous pouvez revenir aux lectures quand elles vous sont utiles. Pour conclure, choisissez une phrase que vous aimeriez retrouver lors d’une journée ordinaire.",
      "You have reached the end of these 31 days. This milestone marks readings and experiments; it does not promise a physical outcome or a permanently established habit.\n\nRevisit your original reason and write what you want to keep today. It may have changed. Your journal, meals and circles remain available, and you can revisit readings when useful. Choose a sentence you would like to find again on an ordinary day.",
    ],
    [
      "Écrivez une lettre courte à votre futur vous.",
      "Write a short letter to your future self.",
    ],
    [
      "Que voudrais-je me rappeler pour continuer à mon rythme?",
      "What would I like to remember as I continue at my own pace?",
    ],
    "habits",
  ],
];
export const lessons: Lesson[] = rows.map(
  ([title, body, action, question, source], index) => ({
    id: `${PROGRAM_VERSION}-${index + 1}`,
    day: index + 1,
    title,
    body,
    action,
    question,
    source,
  }),
);
export function programState(progress: ProgramProgress, today: string) {
  const next = lessons.findIndex((l) => !progress.completed[l.id]);
  return {
    index: next < 0 ? lessons.length - 1 : next,
    finished: next < 0,
    completed: lessons.filter((l) => progress.completed[l.id]).length,
    available: !Object.values(progress.completed).includes(today),
  };
}
export function completeLesson(
  progress: ProgramProgress,
  lessonId: string,
  today: string,
): ProgramProgress {
  const state = programState(progress, today);
  if (
    state.finished ||
    !state.available ||
    lessons[state.index].id !== lessonId
  )
    throw Error("progress");
  return {
    ...progress,
    completed: { ...progress.completed, [lessonId]: today },
  };
}

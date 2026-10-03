# SILO-01 — Plan de développement

Suivi vivant de ce qui est fait et de ce qui reste, par rapport au document de conception
(les numéros § renvoient à ses sections). Mis à jour à chaque étape.

Légende : ✅ fait · 🟡 partiel · ⬜ à faire

---

## Feuille de route

### Étape 0 — Socle (livrée)
- ✅ Projet Vite + TypeScript + React + PixiJS + Zustand + Web Worker + IndexedDB (§17–18)
- ✅ Simulation headless découplée du rendu, tick de 10 min, vitesses pause/×1/×2/×5/×10 (§9, §33)
- ✅ 12 étages, 1 400 habitants, foyers, graphe social, responsables (§4, §6, §47)
- ✅ Rendu pixel art du silo vertical, caméra/zoom, culling, PNJ poolés (§21–27)
- ✅ ~35 décisions data-driven, effets différés, chaînes causales (§12–13, §37)
- ✅ Assets générés (salles, portraits, surface) + script de découpe `tools/build-art.sh`

### Étape 1 — Consolidation & entrée en jeu (livrée, sauf mesure de perf)
- ✅ Scène d'introduction : prologue, le Pacte fermé, ouverture, 8 articles, serment, signature et sceau de cire
- ✅ Tutoriel guidé en 12 étapes enchaîné après l'intro (projecteur, étapes à action : cliquer l'étage -08, trancher une vraie fuite, ouvrir Infrastructure, relancer le temps)
- ✅ Intro et tutoriel rejouables depuis les Paramètres ; la partie démarre en pause
- ✅ Mode debug (`?debug`) : pannes, accident minier, colère, « Je veux sortir », rumeur, stocks pleins
- ✅ Banc d'équilibrage headless `npm run balance` (joueur passif vs joueur automatique)
- ✅ Moins de va-et-vient dans la cage d'escalier
- ✅ Pénuries : les plus vulnérables (enfants, anciens) d'abord, causes de décès précises, écran de fin lisible
- ✅ Chocs d'usure plus fréquents (début de partie moins calme)
- ⬜ Vérifier les performances sur une vraie machine (objectif : 60 FPS, 200 PNJ, ×5) (§32) — à faire de ton côté

**Mesures d'équilibrage** (10 graines × 60 jours) :

| Joueur | Survie médiane | Parties complètes | Stabilité min. moyenne | Morts moyens |
|---|---|---|---|---|
| Passif | 34 j | 0/10 | 2 | 343 |
| Automatique naïf | 60 j | 9/10 | 46 | 2 |

Sur 120 jours, le joueur automatique perd la moitié de ses parties : la légitimité s'érode lentement
(68 → 44 au jour 90) si l'on ne fait que gérer techniquement. Il faut donc aussi gouverner
(élections, promesses tenues, vérité, concessions) — c'est voulu.

### Étape 1 bis — Réfectoires et écran extérieur (livrée)
- ✅ Silo restructuré en 14 étages avec identifiants explicites (`water`, `mines`…) au lieu de `f08`, `f12`
- ✅ Grand réfectoire en -01, juste sous la surface : écran géant sur le monde extérieur
- ✅ Cafétéria des profondeurs en -09 avec écran relais ; chacun mange au réfectoire le plus proche
- ✅ Vue extérieure rendue en direct dans les écrans (masque : les lampes restent devant), dérive lente, parasites, coupure si plus de courant
- ✅ Netteté des capteurs : la poussière salit l'écran jour après jour et pèse sur le moral de tout le silo
- ✅ Le nettoyage (« Je veux sortir ») rend l'écran net ; événement « L’écran se voile » : attendre un volontaire, envoyer un condamné, ou éteindre les écrans
- ⬜ Quand le silo grandira (étape 3) : une cafétéria tous les ~10 étages, files d'attente aux heures de repas, écran du grand réfectoire comme lieu de rassemblement lors des crises

### Étape 2 — Cœur systémique (livrée)
- ✅ **Justice** (§150, §169–171) : toute arrestation ouvre un dossier (solidité selon enquêtes, infiltration, flagrant délit) → 2 jours de détention → procès. Laisser le juge trancher, imposer une condamnation (précédent, juge désavoué si dossier faible), gracier, ou nettoyage (pouvoirs d'urgence). Appels, peines purgées, cellules surpeuplées. Panneau Justice. Tribunal visible à l'étage -03.
- ✅ **Rumeurs** (§112–114) : 9 rumeurs nées de faits vrais, partiels ou inventés ; propagation d'étage en étage et brassage dans les réfectoires aux heures de repas ; effets sur peur, colère, confiance. Vérité inconnue sans enquête DSI ; démentir une rumeur vraie peut éclater plus tard, confirmer une rumeur fausse aussi. Plus de conciliabules dans le silo là où une rumeur circule.
- ✅ **Factions** (§126–127, §134) : émergence autour d'un meneur quand un secteur est rancunier, recrutement par les liens d'amitié, 5 stades (cercle, mouvement, organisation, préparation, insurrection), revendications, ralentissements puis sabotages. Signaux faibles avant identification (tags sur les murs du silo, absentéisme). Réponses : céder, coopter, infiltrer, arrêter le meneur (martyr possible), dissoudre (pouvoirs d'urgence).
- ✅ **Conseil du silo** (§162–163, §187, §191–192) : sujet le plus pressant, prise de position argumentée de chaque responsable (secteur, traits, loyauté), options avec leurs soutiens, alliances et rivalités qui évoluent ; ceux qu'on suit gagnent en loyauté.
- ✅ Mécontentement de fond : la rancœur ne retombe plus à zéro (fatigue, mines, surpeuplement, rations, écran sale, ex-détenus).
- ✅ Tests dédiés (`tests/society.test.ts`) et nouveaux outils debug (faction, rumeur, arrestation).

**Mesures** (12 graines × 60 jours) : passif 34 j médian (0/12) ; joueur automatique 12/12 mais stabilité min. moyenne 35 (51 avant l'étape 2) — il ignore rumeurs et factions, qui pèsent désormais.

### Étape 3 — Échelles de lecture & contenu (livrée)
- ✅ Silo de 30 étages, 3 000 habitants (production/stocks mis à l'échelle), un réfectoire tous les ~10–11 étages (-01 grand réfectoire, -12 et -23 relais) avec écran extérieur (§4, §30)
- ✅ 5 nouveaux types de salles générés : école, bazar, quartiers ouvriers, blanchisserie, serre ; descriptions par salle (`src/sim/data/rooms.ts`)
- ✅ Vue Salle : clic sur une salle quand on est zoomé (ou boutons « Salle ouest/est » de la fiche étage) → caméra centrée, fiche avec description, équipement, présents à l'heure et leur activité (§5)
- ✅ Vue Personne : « Suivre dans le silo » depuis une fiche habitant → la caméra suit un PNJ qui le représente (escaliers, trajets), carte avec activité en cours et bandeau des 24 h (école, travail, repas au réfectoire, bazar, repos) (§5)
- ✅ 40 événements de plus (75 au total) : école, bazar/marché noir, récoltes, blanchisserie, surpopulation, ascenseur, porteurs, grippe, gaz de mine, filon, eau, génératrice, pompe, départ d'expert, intrusion DSI, archives, maire malade, juge qui part, adjoint corrompu, mariage, enfant perdu, accaparement, vol d'électricité, chanson interdite, bagarre au réfectoire, jour de la Fondation…
- ✅ Ambiance vivante (`src/render/ambient.ts`) : lampes, voyants et plantes détectés dans les pixels des images ; halos qui respirent et vacillent, secours rouges en panne ; voyants qui clignotent (s'éteignent sans courant) ; cultures en cycle de 6 jours (pousse, tomates qui mûrissent, récolte en vague, jaunissent en cas de maladie ou de manque d'eau) et qui ondulent ; vapeur (blanchisserie, cuisines aux heures de repas), fumée de la génératrice en surcharge/panne, poussière des mines (verdâtre en cas de gaz), gouttes sous les pompes et du plafond des étages usés, cadrans de la génératrice qui suivent la charge ; respecte les réglages effets/éclairage et la dégradation adaptative
- ✅ Test catalogue : chaque événement s'ouvre et chacun de ses choix se résout sans erreur ni placeholder (`tests/events.test.ts`)

### Étape 4 — Jeu complet (livrée)
- ✅ Calendrier du silo : années de 48 jours (an 142, 143…), mandat de 3/4/5 ans selon la difficulté ; maire élu pour 2 ans
- ✅ Démographie sur plusieurs années : vieillissement au Jour de la Fondation, passage à l'âge adulte (affectation à 16 ans), retraite à 65 ans (perte d'expertise), mortalité naturelle par âge, loterie des naissances (politique, article IV du Pacte)
- ✅ Mémoire collective (§116) : la chronique retient les crises (accidents miniers, Grande Panne, faim, soif, fièvre, émeutes, soulèvement, blocus, procès imposés, morts de titulaires) ; une crise du même type ravive les anciennes (peur, rancœur, confiance chez ceux qui les ont vécues) ; effacement annuel selon la difficulté ; commémoration (officielle, discrète, interdite)
- ✅ Bilan annuel (pause automatique) : population, naissances, décès, arrestations, stabilité, souvenirs de l'année
- ✅ Fins : 4 défaites (Le silo se vide, Le Soulèvement, Destitution, Le Silence — génératrice jamais rallumée) et 4 fins de mandat selon le style de gouvernance (L'Âge du Pacte, L'Ordre de fer, Le silo tient, et la fin secrète La Vérité) ; épilogue, statistiques, chronique ; partie libre après la victoire
- ✅ Secrets : chaîne des archives (fichier effacé → « Silo 01 sur 50 » → révéler, garder au conseil avec risque de fuite, ou effacer)
- ✅ Modes de difficulté (§198) : Accessible / Standard / Difficile — fiabilité des données, franchise des responsables, vitesse des rumeurs, tolérance, mémoire sociale, vitesse des crises politiques, durée du mandat ; choisis comme « clause du mandat » à la signature du Pacte ou à la nouvelle partie
- ✅ Son procédural (§70) : bourdonnement de la génératrice (plus fort quand on la regarde, ralentit puis silence en panne, redémarrage), ventilation, rumeur de foule selon les troubles, gouttes (audibles surtout dans le silence), alarmes, signaux d'interface, cloche du Nouvel An ; volume et coupure dans les paramètres
- ✅ Reprise automatique de la dernière partie au chargement de la page
- ✅ Déploiement : workflow GitHub Pages (tests + build sous `/<dépôt>/`), déclenché sur `master` ou à la main
- ✅ Équilibrage long : trêve de 8 jours après une concession à une faction ; la légitimité tient compte des résultats (silo nourri, abreuvé, éclairé). Banc 200 jours : joueur automatique naïf 5/6 mandats complets en Standard, 4/4 en Accessible, 0/4 en Difficile ; joueur passif ≈ 35 jours

### Étape 5 — La vie sous les yeux & institutions (livrée)
- ✅ Vie quotidienne visible : points d'intérêt mesurés dans chaque salle (`src/render/hotspots.ts`) ; files d'attente aux comptoirs et repas à table (petit mouvement de cuillère), enfants (sprites réduits) aux pupitres de l'école avec un·e adulte au tableau, flânerie devant les étals du bazar le soir, retour chez soi par les portes la nuit, couchettes des dortoirs et lits de l'infirmerie occupés, assemblées au conseil et au tribunal, rassemblement devant l'écran des réfectoires lors d'une panne, d'une commémoration ou d'une rumeur sur le dehors (§7)
- ✅ Adjoints du shérif affectés aux étages (§43–44 bis) : patrouilles limitées par les effectifs de sécurité (la moitié patrouille), effets sur les débordements, les rumeurs, les vols aux fournitures et la détection des factions ; peur et rancœur des habitants surveillés (« occupation » après trois jours) ; adjoints visibles qui arpentent l'étage
- ✅ Confiance par institution (§100–111) : mairie, judiciaire, sécurité, mécanique, médical, DSI ; cibles calculées à partir des actes (promesses, jugements imposés, pannes, malades, écrans…), chocs ponctuels, tendance et causes affichées ; effets en retour (justice discréditée → arrestations perçues comme injustes, mécanique discréditée → peur, médical discrédité → moral, mairie → légitimité et crédibilité des démentis, sécurité → efficacité des patrouilles)
- ✅ Alertes regroupées (« Pannes ×3 ») et panneau « À venir » (§34–36) : épuisement des stocks, pannes probables, procès, promesses, élection, factions qui se radicalisent, blocus qui s'éternisent, Jour de la Fondation et fin de mandat
- ✅ Outils de test : saut à une heure donnée (debug), vue et store exposés en `?debug`

### Étape 6 — Pistes suivantes (à faire)
- ⬜ Lois du silo modifiables et matrice des pouvoirs (§146–199, §197) : mode d'élection, durée des mandats, pouvoirs du maire/shérif/juge, autonomie des étages, votées au conseil
- ⬜ Blocus : réouverture par étapes et exceptions (médical, mécanique, ravitaillement) (§80–99)
- ⬜ Groupes sociaux transverses (familles élargies, congrégations, anciens) (§16)
- ⬜ Adéquation fine compétence/poste et formation (§43)
- ⬜ Stocks physiques par étage et transferts (§48–52 bis)
- ⬜ Mesure de performance sur une vraie machine (§32)

### Phase visuelle — Profondeur « 2D enrichie » (A et B livrées, C et D à faire)
Objectif : garder le pixel art mais donner du volume, à la manière des jeux en couches avec éclairage par pixel
(référence citée : Soulbound). État actuel : chaque salle est une image plate 256×104, les PNJ marchent sur une seule
ligne, la lumière est un voile global par étage + des halos additifs (ambiance de l'étape « ambiance »).

- ✅ **A. Gains rapides, sans nouvelle image** — livrée : rendu du monde à sa résolution native dans une texture puis agrandi (pixels nets), 3 couloirs de profondeur pour les habitants (plus petits et plus sombres au fond) avec ombres au sol, carte de lumière (lampes détectées, plafonniers hors champ, lueur des écrans, torches des adjoints la nuit, cabine d'ascenseur, gyrophares rouges en panne générale), rayons de lumière (réglage Élevé), brume de profondeur, étalonnage (matin chaud, soir doré, nuit bleutée, panne désaturée, émeute rougie), écrans cathodiques (lignes de balayage, bande qui défile). Réglage Éclairage : Bas = rendu classique ; la dégradation adaptative redescend Élevé → Moyen → Bas si les FPS chutent
  - Rendu pixel-parfait : le monde dessiné dans une texture basse résolution puis agrandi par paliers entiers (les effets restent nets)
  - 2 à 3 « couloirs » de profondeur par salle : PNJ du fond plus petits/sombres, tri par profondeur, ombres au sol
  - Carte de lumière : chaque lampe déjà détectée éclaire vraiment son entourage (lumière multipliée), nuit et pannes bien plus dramatiques, lampes torches des adjoints, gyrophares de secours
  - Rayons de lumière sous les lampes, brume de profondeur (les étages profonds plus voilés), étalonnage couleur selon l'heure, le secteur et les crises, léger bloom sur les points brillants, écran des réfectoires façon tube cathodique
- ✅ **B. Relief par pixel** — livrée : cartes de normales générées au chargement depuis chaque image de salle (versions miroir pour les ailes retournées, normales quantifiées), passe de normales et shader d'éclairage PixiJS (48 lumières, lumière quantifiée par paliers) ; relief modéré en Moyen, marqué en Élevé
  - Cartes de normales générées par script à partir des images existantes (relief estimé depuis la luminance et les contours ; aucun modèle de profondeur disponible sur Monid)
  - Shader d'éclairage PixiJS (jusqu'à ~24 lumières par étage visible) : les murs, machines et tuyaux prennent la lumière de côté ; liseré lumineux sur les PNJ
- ⬜ **C. Salles en couches** (≈ 1–2 sessions, ≈ 3–6 $ de génération)
  - Chaque salle découpée en fond / mobilier / premier plan (piliers, rambardes, tuyaux) : les PNJ passent derrière le premier plan
  - Pipeline : version « salle vide » par édition d'image (Wan ou GPT-image avec l'image actuelle en référence), mobilier isolé par différence, éléments de premier plan générés sur fond uni puis détourés (Topaz, ≈ 0,10 $/image)
  - Parallaxe légère entre couches quand la caméra bouge
- ⬜ **D. Profondeur du silo lui-même** (≈ 1 session, ≈ 1 $)
  - Strates de roche en parallaxe derrière le fût, cage d'escalier dessinée en perspective, câbles et conduites verticales au premier plan, surface et ciel en plusieurs plans
- Risques : cohérence entre couches générées par IA (retouches à prévoir), relief « gaufré » si les normales sont trop fortes, coût GPU sur machines modestes (tout passera par le réglage « Éclairage » : bas = rendu actuel)
- Ordre conseillé : A → B → C → D, avec un prototype sur une seule salle (le grand réfectoire) avant de généraliser

---

## Couverture du document de conception

| § | Sujet | État | Notes |
|---|---|---|---|
| 1–3 | Vision, piliers, boucle | ✅ | Le silo vit sans le joueur ; décisions à coût/risque |
| 2.4 | Paliers de réponse (pas de « dernier recours ») | 🟡 | La plupart des crises ont 3–4 options ; à systématiser |
| 4 | Structure du silo par étages | ✅ | 30 étages dont 3 réfectoires (-01, -12, -23) |
| 5 | Vues Silo / Étage / Salle / Personne | ✅ | Silo, fiche étage, vue Salle, vue Personne (suivi + journée) |
| 6 | Population simulée vs PNJ visibles | ✅ | 75–400 PNJ selon réglage |
| 7 | Animations et petits événements visuels | ✅ | PNJ (marche, escaliers, travail, porter, réparer, assis, discuter, bulles) + ambiance des salles : halos de lampes, voyants, plantes qui poussent et ondulent, vapeur, fumée, poussière, gouttes, cadrans ; repas, files, sommeil, école, marché, rassemblements |
| 8 | Routines quotidiennes | ✅ | Présence par heure et par étage ; école, repas au réfectoire, bazar le soir |
| 9 | Temps et vitesses | ✅ | |
| 10–11 | Ressources, production/consommation, dépendances | ✅ | eau, nourriture, énergie, fer, pièces, médicaments |
| 12 | Événements data-driven | ✅ | `src/sim/data/events.ts` — 75 événements |
| 13 | Conséquences différées, tags | ✅ | |
| 14 | Information imparfaite | ✅ | stocks déclarés/réels, capteurs, responsables qui minimisent |
| 15 | Responsables de département | ✅ | 9 fonctions, avis dans les décisions |
| 16 | Groupes sociaux | 🟡 | Secteurs avec cohésion ; groupes transverses à faire |
| 17–19 | Stack, architecture, managers | ✅ | Systèmes au lieu de classes Manager |
| 20 | Pathfinding A* | ✅ | Graphe des paliers |
| 21 | Sprite sheets / atlas | ✅ | Atlas procédural unique |
| 22 | Culling des étages | ✅ | |
| 23 | Pixel perfect | ✅ | nearest-neighbor |
| 24–26 | Réglages graphiques, dégradation adaptative, LOD | 🟡 | Densité, effets, éclairage, adaptatif ; LOD par distance non fait |
| 27 | Pooling | ✅ | 400 PNJ réutilisés |
| 28 | Sauvegarde IndexedDB | ✅ | Auto chaque jour ; cloud (phase 2) non fait |
| 34–36 | UX : hiérarchie des alertes, regroupement, anticipation | ✅ | Sévérités, regroupement par nature, panneau « À venir » |
| 37 | Crises explicables | ✅ | Chaîne causale par incident |
| 41–42 | Habitants clés, fonctions institutionnelles | ✅ | |
| 43 | Compétences, traits, adéquation au poste | 🟡 | Compétence/leadership/intégrité/traits ; adéquation fine à faire |
| 44 | Élections, nominations, successions | ✅ | Intérim automatique |
| 45 | Mort/disparition d'un habitant clé | ✅ | Perte d'expertise, vacance, impact social, mémoire |
| 46–48 | Familles, communautés, graphe social, propagation | ✅ | |
| 49 | Légitimité et perception | 🟡 | Légitimité perçue des arrestations/morts ; vérité vs croyance à approfondir (rumeurs) |
| 43–44 bis | Shérif et adjoints | ✅ | Adjoints = habitants, patrouilles par étage, visibles |
| 45 bis | Responsables d'étage | ✅ | Fiabilité des rapports |
| 47 bis | Secteur mécanique | ✅ | |
| 48–52 bis | Fournitures, stocks, vols, écarts d'inventaire | 🟡 | Stock global ; stocks physiques par étage et transactions à faire |
| 53–58 | Mines, risque, accidents, chaîne fer → pièces | ✅ | |
| 65 | Nettoyage et salubrité | ✅ | |
| 66–75 | Génératrice, énergie de secours, peur, communication de crise | ✅ | |
| 80–99 | Blocus d'étage | 🟡 | 3 niveaux, navigation, coûts, contrebande ; réouverture par étapes et exceptions fines à faire |
| 100–111 | Variables psychologiques, confiance par institution, leaders informels | ✅ | Confiance par habitant + par institution (6), leaders informels |
| 112–115 | Rumeurs, communication officielle | ✅ | Propagation par étages et réfectoires, vérité cachée, démentis |
| 116–122 | Mémoire collective/individuelle, griefs, promesses | ✅ | Chronique des crises qui se ravivent, commémorations, mémoires individuelles, promesses ; griefs typés par faction |
| 123–129 | Protestation → insurrection, réponses | ✅ | Paliers 0–5 + factions organisées, signaux précurseurs |
| 130–133 | Micro-management, élections, responsabilité perçue | 🟡 | |
| 134 | Factions | ✅ | Émergence, recrutement, stades, revendications |
| 135–138 | Performance sociale, promotion dynamique | ✅ | Tick social horaire, propagation bornée, agitateurs promus |
| 146–199 | Gouvernance : institutions, conseil, lois, précédents, urgence, corruption, audits, transparence | 🟡 | Conseil, alliances, justice, précédents (juge contourné), urgence, audits, transparence ; lois modifiables et matrice des pouvoirs à faire |
| 70 | Effet psychologique de la génératrice | ✅ | Visible (lumières, secours rouges), audible (silence, alarmes), systémique (peur) |
| 198 | Modes de difficulté liés à la gouvernance | ✅ | Accessible / Standard / Difficile |
| 200 | Cycle politique, justice, progression, fins, secrets | ✅ | Élections, justice, années, 8 fins, secret des archives ; d'autres secrets possibles |

---

## Journal des livraisons

- **Phase visuelle A + B** — rendu pixel-parfait, carte de lumière et relief par pixel, couloirs de profondeur, ombres, rayons, brume, étalonnage, écrans cathodiques (aucune image générée).
- **Étape 5** — vie quotidienne visible, patrouilles d'adjoints, confiance par institution, alertes regroupées et « À venir » (aucune image générée).
- **Étape 4** — années, démographie, mémoire collective, bilans, 8 fins, difficulté, son procédural, déploiement GitHub Pages (aucune image générée).
- **Ambiance** — animation du décor des salles sans nouvelle image (analyse des pixels + émetteurs placés à la main).
- **Étape 3** — 30 étages / 3 000 habitants, 3 réfectoires, vue Salle, vue Personne, 40 nouveaux événements (5 images générées : école, bazar, quartiers, blanchisserie, serre ≈ 0,15 $).
- **Étape 0** — socle jouable : simulation, rendu, UI, assets, tests headless.
- **Étape 2** — justice, rumeurs, factions, conseil (2 images générées : tribunal, salle du conseil ; une génération bloquée relancée).
- **Étape 1 bis** — réfectoires avec écran sur l'extérieur (3 images générées : grand réfectoire ×2 essais, cafétéria des profondeurs), netteté des capteurs et nettoyage.
- **Étape 1** — intro du Pacte (2 images générées : livre fermé, livre ouvert créé à partir du fermé), tutoriel guidé, mode debug, banc d'équilibrage, ajustements.

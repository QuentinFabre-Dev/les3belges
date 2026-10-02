# SILO-01 — Gestion externe

Jeu de gestion web inspiré de *Silo* : vous administrez un silo souterrain de 1 400 habitants.
Vous ne contrôlez pas les habitants : vous arbitrez entre des solutions imparfaites, et le silo réagit,
parfois plusieurs jours plus tard.

![aperçu](docs/apercu.png)

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # simulation headless (vitest)
npm run build      # typecheck + build de production
```

Raccourcis : `Espace` pause, `1`–`4` vitesses ×1/×2/×5/×10, `Échap` revenir à la vue globale.
Molette pour défiler, `Ctrl`+molette pour zoomer, glisser pour déplacer, clic sur un étage ou un habitant.

## Architecture

```
src/
  sim/                 Simulation (Web Worker, aucune dépendance au rendu)
    types.ts           Modèle de données normalisé + protocole Worker + snapshot
    create.ts          Génération du monde (foyers, métiers, graphe social, responsables)
    engine.ts          Tick (10 min de jeu), commandes, requêtes, snapshot compact
    worker.ts          Boucle à pas fixe (2→20 ticks/s), sauvegarde IndexedDB
    systems/
      economy.ts       Production/consommation, énergie et délestage par priorités
      infrastructure.ts Usure, chocs, maintenance (pièces), pannes, réparations, accidents miniers
      social.ts        Besoins, salubrité, routines, agitation, propagation sociale, vols
      events.ts        Moteur data-driven : conditions, effets génériques, effets différés,
                       promesses, élections, nominations, blocus
    data/
      world.ts         Étages, secteurs, fonctions institutionnelles
      events.ts        ~35 événements/décisions (contenu, sans code moteur)
  render/              PixiJS (main thread)
    SiloView.ts        Silo vertical, caméra/zoom, culling des étages, éclairage, blocus,
                       pool de 400 PNJ, dégradation adaptative
    sprites.ts         Sprites d'habitants procéduraux → un seul atlas (1 draw call)
    navigation.ts      Graphe des paliers + A* (le blocus bloque des arêtes)
    textures.ts        Cage d'escalier, dalles, murs, roche
  ui/                  React + Zustand (HUD, décisions, panneaux)
  game/store.ts        Pont Worker ⇄ UI (commandes, requêtes, snapshot)
tests/sim.test.ts      Scénarios headless (déterminisme, mort d'un mineur, panne génératrice…)
```

Principes respectés du document de conception :

- **Simulation ≠ rendu** : 1 400 habitants simulés dans le Worker, 75 à 400 PNJ affichés,
  répartis selon l'activité réelle de chaque étage et de l'heure.
- **Data-driven** : les décisions sont des données (conditions, choix, effets, effets différés, tags).
  Ajouter un événement ne touche pas au moteur.
- **Conséquences différées et chaînes causales** : chaque incident liste ses causes
  (maintenance reportée, alertes ignorées, pièces volées, sous-effectif…).
- **Information imparfaite** : stocks déclarés ≠ stocks réels (vols), capteurs bruités selon
  la DSI, responsables d'étage qui minimisent.
- **Système social** : graphe de relations, propagation des deuils/arrestations selon la
  proximité et la cohésion du secteur, rancœur, légitimité, élections émergentes.
- **Paliers de réponse** : quasiment chaque crise offre prévention, mitigation, coercition, attente.

## Assets

Les salles, portraits et la surface ont été générés via le MCP Monid
(`alibaba/wan2.7-image`) sous forme de planches, puis découpés et réduits en vrai pixel art
(palette 64 couleurs) par `tools/build-art.sh`. Les habitants sont dessinés procéduralement
(`src/render/sprites.ts`) pour pouvoir être animés et déclinés par secteur.

## Feuille de route

Prochaines briques : vue Salle, factions explicites, rumeurs propagées dans le graphe,
justice détaillée (procès, appels), mines multi-sites, progression sur plusieurs années,
tutoriel, conditions de victoire.

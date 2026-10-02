import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { send, useGame } from '../game/store';
import type { Snapshot } from '../sim/types';

// Tutoriel guidé : chaque étape cible un élément de l'interface (data-tut ou sélecteur CSS)
// et avance soit au clic sur « Suivant », soit quand le joueur a fait l'action demandée.

interface Ctx {
  s?: Snapshot;
  view: string;
  floor?: string;
  enteredAt: number;
}

interface Step {
  title: string;
  text: string | ((name: string) => string);
  target?: string;
  place?: 'right' | 'left' | 'middle' | 'bottom' | 'top' | 'center' | 'inside';
  done?: (c: Ctx) => boolean;
  enter?: () => void;
  hint?: string;
}

const STEPS: Step[] = [
  {
    title: 'Prise de fonction',
    text: (n) => `Bienvenue, ${n}. Le temps est suspendu le temps de vous présenter le silo. Vous pourrez rejouer ce tutoriel depuis les paramètres.`,
    place: 'center',
  },
  {
    title: 'Le silo',
    text: 'Voici le silo, étage par étage. Les habitants que vous voyez représentent l’activité réelle de chaque étage. Molette pour défiler, Ctrl + molette pour zoomer, glisser pour vous déplacer.',
    target: '.stage',
    place: 'inside',
  },
  {
    title: 'Les ressources',
    text: 'Nourriture, eau, énergie, matériaux : ce sont les chiffres des registres. Survolez-les pour voir l’autonomie en jours. Attention : un registre peut mentir, seul un audit révèle les stocks réels.',
    target: '[data-tut=resources]',
    place: 'bottom',
  },
  {
    title: 'Le temps',
    text: 'Pause, ×1, ×2, ×5, ×10. Raccourcis : Espace pour la pause, 1 à 4 pour les vitesses. Le silo continue de vivre quand vous ne faites rien.',
    target: '[data-tut=speeds]',
    place: 'bottom',
  },
  {
    title: 'Inspecter un étage',
    text: 'Cliquez sur l’étage -08 Eau dans le silo (la station de pompage). Il est centré pour vous.',
    target: '.stage',
    place: 'inside',
    enter: () => {
      useGame.getState().selectFloor(undefined);
      useGame.setState({ focusRequest: { floor: 'f08', n: Date.now() } });
    },
    done: (c) => c.floor === 'f08',
    hint: 'Cliquez sur l’étage -08 pour continuer',
  },
  {
    title: 'La fiche d’étage',
    text: 'Présents, personnel, énergie, propreté, moral, équipements. La colère est rapportée par le responsable d’étage : certains minimisent. En bas, vous pouvez contrôler les accès ou imposer un blocus.',
    target: '.floor-card',
    place: 'right',
  },
  {
    title: 'Une décision',
    text: 'La pompe principale fuit. Lisez la description et les avis des responsables : ils ne sont pas d’accord. Chaque choix a un coût, un risque et parfois une conséquence différée. Tranchez.',
    target: '.right .decision',
    place: 'left',
    enter: () => send({ type: 'SPAWN_EVENT', eventId: 'water_leak', floor: 'f08', assetId: 'pump_main' }),
    done: (c) => Date.now() - c.enteredAt > 1500 && !!c.s && !c.s.decisions.some((d) => d.title.startsWith('Fuite')),
    hint: 'Choisissez une option pour continuer',
  },
  {
    title: 'Infrastructure',
    text: 'Ouvrez le panneau Infrastructure dans le menu de gauche.',
    target: '[data-tut=nav-infrastructure]',
    place: 'right',
    done: (c) => c.view === 'infrastructure',
    hint: 'Cliquez sur « Infrastructure »',
  },
  {
    title: 'Prévenir plutôt que réparer',
    text: 'Chaque équipement s’use. Les mécaniciens répartissent la maintenance, et vous pouvez imposer un « Focus ». Une pièce volée, une alerte ignorée, et c’est la panne des semaines plus tard.',
    target: '.overlay-panel',
    place: 'middle',
  },
  {
    title: 'Comprendre les crises',
    text: 'Les Incidents expliquent la chaîne causale de chaque crise. Le Journal garde la mémoire de vos décisions. Les Messages viennent des responsables : lisez-les avec prudence.',
    target: '[data-tut=nav-incidents]',
    place: 'right',
    enter: () => useGame.getState().setView('global'),
  },
  {
    title: 'Gouverner',
    text: 'Institutions : nommer, révoquer, organiser une élection. Politiques : rations, quotas miniers, priorités de délestage, communication de crise, audits. Population : chaque habitant a une famille, des relations et une mémoire.',
    target: '[data-tut=nav-institutions]',
    place: 'right',
  },
  {
    title: 'À vous',
    text: 'Relancez le temps avec ▶. Gouverner le silo, c’est moins choisir la meilleure solution que choisir la conséquence que l’on accepte.',
    target: '[data-tut=speeds]',
    place: 'bottom',
    done: (c) => (c.s?.speed ?? 0) > 0,
    hint: 'Appuyez sur ▶ pour commencer',
  },
];

export function Tutorial({ name, onDone }: { name: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const enteredAt = useRef(Date.now());
  const s = useGame((g) => g.snapshot);
  const view = useGame((g) => g.view);
  const floor = useGame((g) => g.selectedFloor);
  const cur = STEPS[step];

  useEffect(() => {
    enteredAt.current = Date.now();
    cur.enter?.();
  }, [step]);

  // Suivi de la cible (elle peut bouger ou apparaître).
  useLayoutEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = cur.target ? document.querySelector(cur.target) : null;
      const r = el?.getBoundingClientRect() ?? null;
      setRect((prev) => (prev && r && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    if (cur.done && cur.done({ s, view, floor, enteredAt: enteredAt.current })) next();
  }, [s, view, floor, step]);

  const next = () => {
    if (step >= STEPS.length - 1) onDone();
    else setStep(step + 1);
  };

  const pad = 6;
  const box = rect && cur.place !== 'center' ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tipW = 340;
  let tip: { left: number; top: number } = { left: W / 2 - tipW / 2, top: H / 2 - 100 };
  if (box) {
    if (cur.place === 'inside') tip = { left: box.left + 20, top: box.top + 20 };
    else if (cur.place === 'right') tip = { left: box.left + box.width + 14, top: box.top + 10 };
    else if (cur.place === 'left') tip = { left: box.left - tipW - 14, top: box.top + 40 };
    else if (cur.place === 'middle') tip = { left: box.left + box.width / 2 - tipW / 2, top: box.top + box.height / 2 - 90 };
    else if (cur.place === 'bottom') tip = { left: box.left + box.width / 2 - tipW / 2, top: box.top + box.height + 14 };
    else tip = { left: box.left + box.width / 2 - tipW / 2, top: box.top - 200 };
    tip.left = Math.max(12, Math.min(W - tipW - 12, tip.left));
    tip.top = Math.max(12, Math.min(H - 220, tip.top));
  }
  const text = typeof cur.text === 'function' ? cur.text(name) : cur.text;
  return (
    <div className="tutorial">
      {box ? <div className="tut-hole" style={box} /> : <div className="tut-dim" />}
      <div className="tut-tip" style={{ ...tip, width: tipW }}>
        <div className="tut-step muted small">
          Tutoriel · {step + 1}/{STEPS.length}
        </div>
        <h3>{cur.title}</h3>
        <p>{text}</p>
        <div className="row between">
          <button className="link small" onClick={onDone}>
            Passer le tutoriel
          </button>
          {cur.done ? <span className="accent small">{cur.hint}</span> : <button className="btn" onClick={next}>Suivant</button>}
        </div>
      </div>
    </div>
  );
}

export const startGameClock = () => send({ type: 'SET_SPEED', speed: 1 });

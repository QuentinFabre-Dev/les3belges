import { useEffect, useState, type ReactNode } from 'react';
import { POPULATION_START } from '../sim/data/world';
import type { Difficulty } from '../sim/types';
import { DifficultyPicker } from './Chronicle';

// Scène d'introduction : le Pacte s'ouvre, on lit ses articles, on le signe.
const base = import.meta.env.BASE_URL;

type Stage = 'prologue' | 'closed' | 'opening' | 'pages' | 'sealed' | 'descent';

interface Spread {
  left: ReactNode;
  right: ReactNode;
}

const PROLOGUE = ['Nul ne se souvient de ce qu’il y avait avant.', 'Il y a le Silo, cent quarante mètres de béton sous la terre morte.', 'Et il y a le Pacte.'];

function Article({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="pact-article">
      <span className="pact-num">{n}.</span> {children}
    </p>
  );
}

export function Intro({ onDone }: { onDone: (name: string, difficulty?: Difficulty) => void }) {
  const [stage, setStage] = useState<Stage>('prologue');
  const [line, setLine] = useState(0);
  const [spread, setSpread] = useState(0);
  const [turning, setTurning] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [signed, setSigned] = useState(false);
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('silo-01:admin-name') ?? '';
    } catch {
      return '';
    }
  });

  const spreads: Spread[] = [
    {
      left: (
        <>
          <h1 className="pact-title">Le Pacte</h1>
          <p className="pact-sub">de l’Ordre du Silo</p>
          <p className="pact-text">Pour que les nôtres survivent, le Silo doit durer. Ces règles furent écrites par les Fondateurs et ne souffrent aucune exception.</p>
          <p className="pact-text">Quiconque les enfreint menace la vie de tous.</p>
        </>
      ),
      right: (
        <>
          <Article n="I">Le Silo est le monde. Rien ne vit au-dessus.</Article>
          <Article n="II">Quiconque demande à sortir sera envoyé au nettoyage. Sa demande ne pourra être retirée.</Article>
          <Article n="III">Les reliques d’avant sont interdites. Celui qui en détient une doit la remettre au judiciaire.</Article>
          <Article n="IV">Les naissances sont accordées par la loterie, selon les places et les rations.</Article>
        </>
      ),
    },
    {
      left: (
        <>
          <Article n="V">Chaque étage obéit à son responsable, chaque responsable au maire, élu par les habitants.</Article>
          <Article n="VI">Le juge interprète le Pacte. Le shérif et ses adjoints le font respecter.</Article>
          <Article n="VII">La génératrice, l’eau et les fermes passent avant toute autre chose.</Article>
        </>
      ),
      right: (
        <>
          <Article n="VIII">La DSI veille sur le Silo et garde la mémoire de ce qui fut. Elle ne commande pas aux habitants : elle arbitre, alloue, tranche — et se tait.</Article>
          <p className="pact-text pact-warn">Les responsables lui rendront compte. Ils ne lui diront pas toujours la vérité.</p>
          <p className="pact-text pact-warn">Chaque décision a un prix. Certaines se paient des semaines plus tard.</p>
        </>
      ),
    },
    {
      left: (
        <>
          <h2 className="pact-title small">Serment</h2>
          <p className="pact-text">Je jure de préserver le Silo et ses habitants, de respecter le Pacte et ceux qui le servent, et d’accepter les conséquences de mes choix.</p>
          <p className="pact-text">Je sais que gouverner, ici, c’est choisir quelle perte l’on est prêt à accepter.</p>
        </>
      ),
      right: (
        <form
          className="pact-sign"
          onSubmit={(e) => {
            e.preventDefault();
            setSigned(true);
            setStage('sealed');
          }}
        >
          <p className="pact-small">Clause du mandat :</p>
          <DifficultyPicker value={difficulty} onChange={setDifficulty} pact />
          <label className="pact-text" htmlFor="pact-name">
            Signé,
          </label>
          <input id="pact-name" className="pact-input" value={name} maxLength={28} placeholder="votre nom" onChange={(e) => setName(e.target.value)} autoFocus />
          <p className="pact-small">Directeur·rice des systèmes d’information du Silo 01</p>
          <button className="pact-btn" type="submit">
            Signer le Pacte
          </button>
        </form>
      ),
    },
  ];

  // Prologue : les lignes apparaissent une à une.
  useEffect(() => {
    if (stage !== 'prologue') return;
    if (line < PROLOGUE.length) {
      const t = setTimeout(() => setLine((l) => l + 1), line === 0 ? 700 : 2200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStage('closed'), 2600);
    return () => clearTimeout(t);
  }, [stage, line]);

  useEffect(() => {
    if (stage === 'opening') {
      const t = setTimeout(() => setStage('pages'), 1400);
      return () => clearTimeout(t);
    }
    if (stage === 'sealed') {
      const t = setTimeout(() => setStage('descent'), 2200);
      return () => clearTimeout(t);
    }
    if (stage === 'descent') {
      const t = setTimeout(() => finish(), 3800);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const finish = () => {
    const n = name.trim() || 'DSI';
    try {
      localStorage.setItem('silo-01:admin-name', n);
    } catch {
      /* ignore */
    }
    // Passer l'introduction sans signer garde la partie déjà en cours.
    onDone(n, signed ? difficulty : undefined);
  };

  const turn = () => {
    if (turning || spread >= spreads.length - 1) return;
    setTurning(true);
    setTimeout(() => setSpread((s) => s + 1), 450);
    setTimeout(() => setTurning(false), 900);
  };

  const s = spreads[spread];
  return (
    <div className={`intro stage-${stage}`}>
      {stage === 'prologue' && (
        <div className="prologue" onClick={() => setStage('closed')}>
          {PROLOGUE.slice(0, line).map((l, i) => (
            <p key={i} className="prologue-line">
              {l}
            </p>
          ))}
        </div>
      )}
      {(stage === 'closed' || stage === 'opening') && (
        <div className="intro-scene" onClick={() => stage === 'closed' && setStage('opening')}>
          <img className="intro-img kenburns" src={`${base}assets/intro/pact_closed.png`} alt="Le Pacte, posé sur un bureau sous une lampe" />
          {stage === 'opening' && <div className="flash" />}
          {stage === 'closed' && (
            <div className="intro-caption">
              <p>Coffre de la DSI — niveau -03</p>
              <button className="pact-btn" onClick={() => setStage('opening')}>
                Ouvrir le Pacte
              </button>
            </div>
          )}
        </div>
      )}
      {(stage === 'pages' || stage === 'sealed') && (
        <div className="intro-scene book">
          <div className="book-frame">
            <img className="intro-img" src={`${base}assets/intro/pact_open.png`} alt="" />
            <div className="page page-left" key={`l${spread}`}>
              {s.left}
            </div>
            <div className="page page-right" key={`r${spread}`}>
              {s.right}
            </div>
            {turning && <div className="leaf" style={{ backgroundImage: `url(${base}assets/intro/page.png)` }} />}
            {stage === 'sealed' && (
              <div className="seal">
                <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden>
                  <path d="M60 4 C78 6 84 14 98 18 C108 30 104 40 114 56 C112 74 106 80 104 96 C90 106 80 104 64 114 C46 112 40 106 24 104 C14 92 16 82 6 66 C8 48 14 42 16 26 C30 14 40 16 60 4Z" fill="#8e1f1a" />
                  <circle cx="60" cy="60" r="38" fill="none" stroke="#c9463c" strokeWidth="3" />
                  <polygon points="60,32 84,46 84,74 60,88 36,74 36,46" fill="none" stroke="#e8b0a0" strokeWidth="3" />
                  {[48, 56, 64, 72].map((y) => (
                    <line key={y} x1="44" x2="76" y1={y} y2={y} stroke="#e8b0a0" strokeWidth="2.5" />
                  ))}
                  <line x1="60" x2="60" y1="40" y2="80" stroke="#e8b0a0" strokeWidth="4" />
                </svg>
              </div>
            )}
          </div>
          {stage === 'pages' && spread < spreads.length - 1 && (
            <button className="pact-btn next" onClick={turn}>
              Tourner la page →
            </button>
          )}
        </div>
      )}
      {stage === 'descent' && (
        <div className="prologue descent">
          <p className="prologue-line">Jour 1, 05:40. La clé du coffre est à votre cou.</p>
          <p className="prologue-line delay">Le Silo compte {POPULATION_START.toLocaleString('fr-FR')} âmes, et pas de maire. Elles ne savent pas encore votre nom, {name.trim() || 'DSI'}.</p>
        </div>
      )}
      <button className="intro-skip" onClick={finish}>
        Passer l’introduction
      </button>
    </div>
  );
}

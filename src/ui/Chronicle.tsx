import { useEffect, useRef, useState } from 'react';
import { send, useGame } from '../game/store';
import { DIFFICULTY } from '../sim/data/difficulty';
import type { Difficulty, Speed } from '../sim/types';
import { Bar } from './common';

const DIFFS: Difficulty[] = ['accessible', 'standard', 'hard'];

/** Choix de la difficulté, présenté comme une clause du Pacte. */
export function DifficultyPicker({ value, onChange, pact = false }: { value: Difficulty; onChange: (d: Difficulty) => void; pact?: boolean }) {
  return (
    <div className={`diff-picker ${pact ? 'pact' : ''}`} role="radiogroup" aria-label="Difficulté">
      {DIFFS.map((d) => {
        const def = DIFFICULTY[d];
        return (
          <button key={d} type="button" role="radio" aria-checked={value === d} className={`diff-opt ${value === d ? 'sel' : ''}`} onClick={() => onChange(d)}>
            <strong>{def.label}</strong>
            <span className="diff-sum">{def.summary}</span>
            {!pact && (
              <ul>
                {def.clauses.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function NewGameDialog({ onClose }: { onClose: () => void }) {
  const current = useGame((g) => g.snapshot?.difficulty ?? 'standard');
  const [d, setD] = useState<Difficulty>(current);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nouvelle partie</h2>
        <p className="muted small">Un nouveau mandat commence. La partie en cours sera remplacée (pensez à la sauvegarder).</p>
        <DifficultyPicker value={d} onChange={setD} />
        <div className="row gap" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            onClick={() => {
              send({ type: 'NEW_GAME', difficulty: d });
              send({ type: 'SET_SPEED', speed: 1 });
              onClose();
            }}
          >
            Prendre ses fonctions
          </button>
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bilan annuel : le jeu se met en pause le temps de le lire. */
export function YearReportModal() {
  const report = useGame((g) => g.snapshot?.yearReport);
  const over = useGame((g) => !!g.snapshot?.gameOver);
  const phase = useGame((g) => g.phase);
  const resume = useRef<Speed>(1);
  useEffect(() => {
    if (!report || over) return;
    const sp = useGame.getState().snapshot?.speed ?? 1;
    resume.current = sp === 0 ? 1 : sp;
    send({ type: 'SET_SPEED', speed: 0 });
  }, [report?.year, over]);
  if (!report || over || phase !== 'play') return null;
  const close = () => {
    send({ type: 'ACK_YEAR_REPORT' });
    send({ type: 'SET_SPEED', speed: resume.current });
  };
  const kv: [string, string][] = [
    ['Population', `${report.population.toLocaleString('fr-FR')} (${report.popDelta >= 0 ? '+' : ''}${report.popDelta})`],
    ['Naissances', String(report.births)],
    ['Décès', String(report.deaths)],
    ['Arrestations', String(report.arrests)],
  ];
  return (
    <div className="modal-back">
      <div className="modal year-report">
        <p className="eyebrow">Jour de la Fondation</p>
        <h2>Bilan de l’an {report.year}</h2>
        <div className="grid4">
          {kv.map(([k, v]) => (
            <div key={k} className="kv">
              <span className="muted">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
        {(
          [
            ['Stabilité', report.stability],
            ['Légitimité', report.legitimacy],
            ['Confiance', report.trust],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="meter">
            <span className="muted">{k}</span>
            <Bar value={v} />
            <span>{v}</span>
          </div>
        ))}
        <h4>Ce dont le silo se souviendra</h4>
        {report.memories.length ? (
          report.memories.map((m) => (
            <div key={m.title} className="memory-row">
              <span>{m.title}</span>
              <Bar value={m.severity} color="var(--bad)" />
            </div>
          ))
        ) : (
          <p className="muted small">Aucune crise marquante.</p>
        )}
        {report.notes.map((n) => (
          <p key={n} className="small">
            {n}
          </p>
        ))}
        <button className="btn primary" onClick={close}>
          Commencer l’an {report.year + 1}
        </button>
      </div>
    </div>
  );
}

const ENDING_EYEBROW: Record<string, string> = {
  golden: 'Fin du mandat',
  iron: 'Fin du mandat',
  fragile: 'Fin du mandat',
  truth: 'Fin du mandat — fin secrète',
  collapse: 'Le silo est perdu',
  uprising: 'Le silo est perdu',
  deposed: 'Le silo est perdu',
  darkness: 'Le silo est perdu',
};

export function EndScreen() {
  const g = useGame((s) => s.snapshot?.gameOver);
  const [newGame, setNewGame] = useState(false);
  if (!g) return null;
  const victory = g.kind === 'victory';
  return (
    <div className="modal-back">
      <div className={`modal ending ${victory ? 'victory' : 'defeat'} end-${g.id}`}>
        <p className="eyebrow">{ENDING_EYEBROW[g.id] ?? (victory ? 'Fin du mandat' : 'Le silo est perdu')}</p>
        <h2>{g.title}</h2>
        <p className="muted">
          An {g.year} — {g.reason}
        </p>
        <div className="epilogue">
          {g.epilogue.map((l, i) => (
            <p key={i} style={{ animationDelay: `${0.4 + i * 0.6}s` }}>
              {l}
            </p>
          ))}
        </div>
        <div className="grid4 end-stats">
          {g.stats.map((s) => (
            <div key={s.label} className="kv">
              <span className="muted">{s.label}</span>
              <span>{s.value}</span>
            </div>
          ))}
        </div>
        {g.chain.length > 0 && (
          <>
            <h4>Derniers événements marquants</h4>
            {g.chain.map((c, i) => (
              <div key={i} className="small cause">
                ↳ {c}
              </div>
            ))}
          </>
        )}
        <div className="row gap wrap" style={{ marginTop: 14 }}>
          {victory && (
            <button className="btn primary" onClick={() => send({ type: 'CONTINUE_FREE' })}>
              Rester en fonction (partie libre)
            </button>
          )}
          <button className="btn" onClick={() => setNewGame(true)}>
            Nouvelle partie
          </button>
          {!victory && (
            <button className="btn" onClick={() => send({ type: 'LOAD' })}>
              Charger la dernière sauvegarde
            </button>
          )}
        </div>
      </div>
      {newGame && <NewGameDialog onClose={() => setNewGame(false)} />}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  mine_accident: 'Mines',
  blackout: 'Énergie',
  famine: 'Vivres',
  thirst: 'Eau',
  epidemic: 'Santé',
  riot: 'Émeutes',
  insurrection: 'Insurrection',
  lockdown: 'Blocus',
  forced_verdict: 'Justice',
  death_key: 'Deuil',
  truth: 'Secret',
};
const MARK: Record<string, string> = { official: 'commémoré', quiet: 'recueillement', forbidden: 'deuil interdit' };

/** Mémoire collective (§116) : ce que le silo n'a pas oublié. */
export function ChronicleList() {
  const list = useGame((g) => g.snapshot?.chronicle ?? []);
  if (!list.length) return <p className="muted small">Le silo n’a encore rien vécu qui marque les mémoires.</p>;
  return (
    <div className="chronicle">
      {list.map((e) => (
        <div key={e.id} className="memory-row">
          <span>
            {e.title}
            <small className="muted">
              {' '}
              · {KIND_LABEL[e.kind]}
              {e.reactivations ? ` · ravivé ×${e.reactivations}` : ''}
              {e.commemorated ? ` · ${MARK[e.commemorated]}` : ''}
            </small>
          </span>
          <Bar value={e.severity} color="var(--bad)" />
        </div>
      ))}
      <p className="tiny muted">Une crise qui se répète ravive le souvenir des précédentes : la peur et la rancœur remontent chez ceux qui les ont vécues.</p>
    </div>
  );
}

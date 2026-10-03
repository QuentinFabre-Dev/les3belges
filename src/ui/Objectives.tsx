import { useState } from 'react';
import { useGame, type View } from '../game/store';
import { Icon } from './common';

const OPEN_KEY = 'silo-01:objectives-open';

/** Objectifs guidés (« par où commencer ? ») : carte repliable au-dessus de « À venir ». */
export function ObjectivesCard() {
  const o = useGame((g) => g.snapshot?.objectives);
  const setView = useGame((g) => g.setView);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== '0';
    } catch {
      return true;
    }
  });
  if (!o) return null;
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? '0' : '1');
    } catch {
      /* ignore */
    }
  };
  const done = o.items.filter((i) => i.done).length;
  const current = o.items.find((i) => !i.done);
  return (
    <div className={`panel objectives ${o.finished ? 'finished' : ''}`} data-tut="objectives">
      <header>
        <button className="row gap grow obj-toggle" onClick={toggle} aria-expanded={open}>
          <h3>{o.title}</h3>
        </button>
        <span className={o.finished ? 'ok small' : 'accent small'}>
          {done}/{o.items.length}
        </span>
        <button className="icon-btn" onClick={toggle} aria-label={open ? 'Replier' : 'Déplier'}>
          <span style={{ display: 'inline-block', transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .15s' }}>
            <Icon name="chevron" size={14} />
          </span>
        </button>
      </header>
      {open && (
        <>
          <p className="obj-intro small muted">{o.intro}</p>
          {o.items.map((i) => (
            <button key={i.id} className={`list-row obj ${i.done ? 'done' : ''} ${i === current ? 'current' : ''}`} onClick={() => i.view && setView(i.view as View)} title={i.hint}>
              <span className="obj-check">{i.done ? <Icon name="check" size={14} color="var(--ok)" /> : <span className="obj-dot" />}</span>
              <span className="grow">
                <span className="small">{i.title}</span>
                {i === current && <small className="muted obj-hint">{i.hint}</small>}
              </span>
              {i.reward && !i.done && <small className="muted obj-reward">{i.reward}</small>}
            </button>
          ))}
        </>
      )}
      {!open && current && <p className="obj-intro small muted">Prochaine étape : {current.title.toLowerCase()}</p>}
    </div>
  );
}

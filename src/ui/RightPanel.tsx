import { useState } from 'react';
import { send, useGame } from '../game/store';
import type { DecisionView } from '../sim/types';
import { Icon, Portrait, RoomThumb, severityColor, severityLabel } from './common';

export function DecisionCard({ d, compact = false }: { d: DecisionView; compact?: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const selectFloor = useGame((g) => g.selectFloor);
  return (
    <div className={`decision ${d.severity}`}>
      <div className="decision-head" style={{ background: severityColor(d.severity) }}>
        <Icon name="alert" size={18} />
        <span>{d.severity === 'critical' ? 'Décision urgente' : 'Décision requise'}</span>
        <small>{d.hoursLeft < 1 ? '< 1 h' : `${Math.round(d.hoursLeft)} h`}</small>
      </div>
      {!compact && <RoomThumb room={d.image} height={86} />}
      <div className="decision-body">
        <div className="decision-cat muted">
          {d.category} · {severityLabel(d.severity)}
          {d.floor && (
            <button className="link" onClick={() => selectFloor(d.floor, true)}>
              voir l’étage
            </button>
          )}
        </div>
        <h3>{d.title}</h3>
        <p>{d.description}</p>
        {d.advice.length > 0 && (
          <div className="advice">
            {d.advice.map((a) => (
              <div key={a.title} className="advice-row">
                <Portrait portrait={a.portrait} sector={a.sector} look={a.look} size={30} />
                <div>
                  <div className="muted small">{a.title}</div>
                  <div className="small">« {a.text} »</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="choices">
          {d.choices.map((c, i) => (
            <button
              key={c.id}
              className="choice"
              disabled={!c.enabled}
              onMouseEnter={() => setHover(c.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => send({ type: 'MAKE_DECISION', uid: d.uid, choiceId: c.id })}
              title={c.enabled ? c.hint : 'Conditions non remplies'}
            >
              <span className="choice-n">{i + 1}</span>
              <span className="choice-label">
                {c.label}
                {(hover === c.id || compact === false) && <small className="choice-hint">{c.hint}</small>}
              </span>
              {c.advisor && <span className="tag">{c.advisor}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RightPanel() {
  const s = useGame((g) => g.snapshot);
  const focused = useGame((g) => g.focusedDecision);
  const focusDecision = useGame((g) => g.focusDecision);
  const selectFloor = useGame((g) => g.selectFloor);
  const setView = useGame((g) => g.setView);
  if (!s) return <aside className="right" />;
  const main = s.decisions.find((d) => d.uid === focused) ?? s.decisions[0];
  const others = s.decisions.filter((d) => d !== main);
  const incidents = s.incidents.filter((i) => i.status !== 'resolved').slice(0, 4);
  return (
    <aside className="right">
      {main ? (
        <DecisionCard d={main} />
      ) : (
        <div className="panel calm">
          <h3>Aucune décision en attente</h3>
          <p className="muted">Le silo suit son cours. Surveillez les indicateurs : les meilleurs administrateurs agissent avant les crises.</p>
        </div>
      )}
      {others.length > 0 && (
        <div className="panel">
          <header>
            <h3>Autres décisions</h3>
            <span className="accent small">{others.length} en attente</span>
          </header>
          {others.slice(0, 4).map((d) => (
            <button key={d.uid} className="list-row" onClick={() => focusDecision(d.uid)}>
              <span className="dot" style={{ background: severityColor(d.severity) }} />
              <span className="grow">
                <span>{d.title}</span>
                <small className="muted">
                  {d.category} · {Math.round(d.hoursLeft)} h
                </small>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      )}
      <div className="panel">
        <header>
          <h3>Incidents récents</h3>
          <button className="link bad small" onClick={() => setView('incidents')}>
            {s.incidents.filter((i) => i.status !== 'resolved').length} non résolus
          </button>
        </header>
        {incidents.length === 0 && <p className="muted small">Aucun incident actif.</p>}
        {incidents.map((i) => (
          <button key={i.id} className="list-row" onClick={() => (i.floor ? selectFloor(i.floor, true) : setView('incidents'))}>
            <Icon name="alert" size={18} color={severityColor(i.severity)} />
            <span className="grow">
              <span>{i.title}</span>
              <small className="muted">{i.floorLabel ? `Étage ${i.floorLabel}` : 'Silo'}</small>
            </span>
            <small className="muted">{i.ageHours < 1 ? 'à l’instant' : i.ageHours < 24 ? `il y a ${Math.round(i.ageHours)} h` : `il y a ${Math.round(i.ageHours / 24)} j`}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}

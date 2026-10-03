import { send, useGame } from '../../game/store';
import type { DemandKind, OfficeId } from '../../sim/types';
import { Bar, Icon, Panel, Portrait, RoomThumb } from '../common';

const close = () => useGame.getState().setView('global');

const STATUS: Record<string, string> = { detention: 'En détention', trial: 'Procès en cours', serving: 'Purge sa peine', closed: 'Clos' };
const VERDICT: Record<string, string> = { acquitted: 'Acquitté·e', prison: 'Condamné·e', cleaning: 'Envoyé·e au nettoyage', pardoned: 'Gracié·e' };

export function JusticePanel() {
  const s = useGame((g) => g.snapshot)!;
  const selectCitizen = useGame((g) => g.selectCitizen);
  const open = s.cases.filter((k) => k.status !== 'closed');
  const closed = s.cases.filter((k) => k.status === 'closed');
  const detained = s.cases.filter((k) => k.status === 'detention' || k.status === 'trial' || k.status === 'serving').length;
  const judge = s.offices.find((o) => o.id === 'judge');
  return (
    <Panel title="Justice" onClose={close}>
      <RoomThumb room="court" height={96} />
      <div className="row gap wrap small muted" style={{ margin: '8px 0' }}>
        <span>Cellules : {detained}/10</span>
        <span>Juge : {judge?.holderName ?? 'vacant'} (légitimité {judge?.legitimacy})</span>
        {s.tags.includes('judge_bypassed') && <span className="bad">Précédent : le juge a été contourné récemment</span>}
      </div>
      <p className="small muted">
        Toute arrestation ouvre un dossier. Après deux jours de détention vient le procès : vous pouvez laisser le juge trancher, imposer une condamnation ou gracier. La solidité du dossier dépend des preuves (enquêtes, infiltration, flagrant délit).
      </p>
      {open.length === 0 && <p className="muted">Aucune affaire en cours.</p>}
      {open.map((k) => (
        <div key={k.id} className="card case">
          <div className="row between">
            <button className="link" onClick={() => selectCitizen(k.defendantId)}>
              <strong>{k.name}</strong>
            </button>
            <span className={k.status === 'trial' ? 'warn small' : 'small muted'}>{STATUS[k.status]}</span>
          </div>
          <div className="small">Motif : {k.charge}</div>
          <div className="meter">
            <span className="muted small">Dossier</span>
            <Bar value={k.evidence} />
            <span className="small">{k.evidence}%</span>
          </div>
          <div className="small muted">
            {k.status === 'detention' && `Procès dans ${Math.ceil(k.hoursToTrial)} h`}
            {k.status === 'serving' && k.daysLeft !== undefined && `Libération dans ${k.daysLeft.toFixed(1)} j`}
            {k.forced && <span className="bad"> · verdict imposé</span>}
            {k.appealed && <span> · appel</span>}
            {` · popularité ${k.popularity}`}
          </div>
          <div className="row gap" style={{ marginTop: 6 }}>
            {k.status === 'detention' && (
              <button className="btn small" onClick={() => send({ type: 'CASE_ACTION', caseId: k.id, action: 'expedite' })}>
                Avancer le procès
              </button>
            )}
            <button className="btn small" onClick={() => send({ type: 'CASE_ACTION', caseId: k.id, action: 'release' })} title="Grâce : libération immédiate">
              Gracier
            </button>
          </div>
          {k.notes.length > 1 && (
            <div className="causes">
              {k.notes.map((n, i) => (
                <div key={i} className="cause">
                  ↳ {n}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {closed.length > 0 && (
        <>
          <h4>Affaires récentes closes</h4>
          {closed.map((k) => (
            <div key={k.id} className="small journal-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <span>
                {k.name} — {k.charge}
              </span>
              <span className={k.verdict === 'cleaning' || k.forced ? 'bad' : 'muted'}>{k.verdict ? VERDICT[k.verdict] : 'Clos'}</span>
            </div>
          ))}
        </>
      )}
    </Panel>
  );
}

const TRUTH: Record<string, [string, string]> = {
  unknown: ['Vérité inconnue', 'muted'],
  true: ['Vraie', 'bad'],
  false: ['Fausse', 'up'],
  partial: ['En partie vraie', 'warn'],
};
const RSTATUS: Record<string, string> = { spreading: 'Se propage', fading: 'S’essouffle', debunked: 'Démentie', confirmed: 'Confirmée', gone: 'Éteinte' };

export function OpinionPanel() {
  const s = useGame((g) => g.snapshot)!;
  const selectCitizen = useGame((g) => g.selectCitizen);
  const selectFloor = useGame((g) => g.selectFloor);
  return (
    <Panel title="Opinion : confiance, rumeurs et factions" onClose={close}>
      <h3>Confiance par institution</h3>
      <p className="small muted">Le silo ne juge pas « l’administration » en bloc. Une justice discréditée rend chaque arrestation suspecte ; une mécanique dont on doute fait trembler au moindre bruit de machine ; une mairie qui tient parole voit sa légitimité remonter.</p>
      <div className="inst-grid">
        {s.institutions.map((i) => (
          <div key={i.id} className="inst">
            <div className="row between">
              <strong>{i.label}</strong>
              <span className={i.trust < 35 ? 'bad' : i.trust < 50 ? 'warn' : ''}>
                {i.trust}
                {i.trend !== 0 && <small className={i.trend > 0 ? 'ok' : 'bad'}> {i.trend > 0 ? '▲' : '▼'}{Math.abs(i.trend)}</small>}
              </span>
            </div>
            <Bar value={i.trust} />
            <div className="tiny muted">{i.causes.length ? i.causes.join(' · ') : 'Rien de notable'}</div>
          </div>
        ))}
      </div>
      <h3>Rumeurs</h3>
      <p className="small muted">
        Les rumeurs naissent de faits réels ou inventés et se propagent d’étage en étage, très vite dans les réfectoires à l’heure des repas. Vous ne savez pas si elles sont vraies sans enquête de la DSI. Démentir une rumeur vraie peut se retourner contre vous ; confirmer une rumeur fausse aussi.
      </p>
      {s.rumors.length === 0 && <p className="muted small">Aucune rumeur notable.</p>}
      {s.rumors.map((r) => {
        const [truthLabel, truthClass] = TRUTH[r.truth];
        return (
          <div key={r.id} className="card rumor">
            <div className="row between">
              <em>« {r.text} »</em>
            </div>
            <div className="row gap small" style={{ margin: '4px 0' }}>
              <span className={truthClass}>{truthLabel}</span>
              <span className="muted">· {RSTATUS[r.status]}</span>
              <span className="muted">· portée ≈ {Math.round(r.reach * 100)} %</span>
              {r.originName && <span className="muted">· source : {r.originName}</span>}
            </div>
            <div className="reach-strip" title="Portée estimée par étage (de -01 à -14)">
              {r.floors.map((f) => (
                <span key={f.id} title={`${f.label} : ${Math.round(f.reach * 100)} %`} style={{ opacity: 0.15 + f.reach * 0.85 }} />
              ))}
            </div>
            {(r.status === 'spreading' || r.status === 'fading') && (
              <div className="row gap wrap" style={{ marginTop: 6 }}>
                <button className="btn small" disabled={r.investigating || r.truth !== 'unknown'} onClick={() => send({ type: 'RUMOR_ACTION', rumorId: r.id, action: 'investigate' })}>
                  {r.investigating ? 'Enquête DSI en cours…' : 'Enquêter (DSI)'}
                </button>
                <button className="btn small" onClick={() => send({ type: 'RUMOR_ACTION', rumorId: r.id, action: 'deny' })}>
                  Démentir
                </button>
                <button className="btn small" onClick={() => send({ type: 'RUMOR_ACTION', rumorId: r.id, action: 'confirm' })}>
                  Confirmer
                </button>
              </div>
            )}
          </div>
        );
      })}

      <h3 style={{ marginTop: 16 }}>Factions</h3>
      <p className="small muted">
        Une faction naît d’une rancœur partagée autour d’un meneur, recrute par les liens d’amitié et monte par étapes : cercle discret, mouvement, organisation, préparation, insurrection. Avant d’être identifiée, elle ne laisse que des signaux.
      </p>
      {s.signals.length > 0 && (
        <div className="card signals">
          <strong className="small warn">Signaux faibles</strong>
          {s.signals.map((sg, i) => (
            <button key={i} className="link block small" onClick={() => selectFloor(sg.floor, true)}>
              ↳ {sg.text}
            </button>
          ))}
        </div>
      )}
      {s.factions.length === 0 && s.signals.length === 0 && <p className="muted small">Aucun groupe organisé repéré.</p>}
      {s.factions.map((f) => (
        <div key={f.id} className={`card faction stage-${f.stage}`}>
          <div className="row between">
            <strong>
              <span className="faction-symbol">{f.symbol}</span> {f.name}
            </strong>
            <span className={f.stage >= 3 ? 'bad small' : f.stage >= 2 ? 'warn small' : 'small muted'}>{f.stageLabel}</span>
          </div>
          <div className="stage-track">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={i <= f.stage ? 'on' : ''} />
            ))}
          </div>
          <div className="small muted">
            {f.sectorName} · étages {f.floors.join(', ')} · {f.members} membres · influence {f.influence}
          </div>
          <div className="small">
            Meneur :{' '}
            <button className="link" onClick={() => selectCitizen(f.leaderId)}>
              {f.leaderName}
            </button>
            {f.infiltrated && <span className="tag">infiltré</span>}
          </div>
          {f.demands.length > 0 && (
            <div className="small" style={{ marginTop: 4 }}>
              Revendications :
              {f.demands.map((d) => (
                <button key={d.kind} className="btn small demand" onClick={() => send({ type: 'FACTION_ACTION', factionId: f.id, action: 'negotiate', demand: d.kind as DemandKind })} title="Céder sur ce point">
                  Céder : {d.label}
                </button>
              ))}
            </div>
          )}
          <div className="row gap wrap" style={{ marginTop: 6 }}>
            <button className="btn small" onClick={() => send({ type: 'FACTION_ACTION', factionId: f.id, action: 'coopt' })}>
              Coopter le meneur
            </button>
            <button className="btn small" disabled={f.infiltrated} onClick={() => send({ type: 'FACTION_ACTION', factionId: f.id, action: 'infiltrate' })}>
              Infiltrer
            </button>
            <button className="btn small danger" onClick={() => send({ type: 'FACTION_ACTION', factionId: f.id, action: 'arrest_leader' })}>
              Arrêter le meneur
            </button>
            <button className="btn small danger" disabled={!s.policies.emergencyPowers} title={s.policies.emergencyPowers ? '' : 'Pouvoirs d’urgence requis'} onClick={() => send({ type: 'FACTION_ACTION', factionId: f.id, action: 'dissolve' })}>
              Dissoudre
            </button>
          </div>
        </div>
      ))}
    </Panel>
  );
}

export function CouncilPanel() {
  const s = useGame((g) => g.snapshot)!;
  const c = s.council;
  const ready = s.councilReadyInHours <= 0;
  const portraitOf = (id: OfficeId) => c?.statements.find((x) => x.officeId === id);
  const active = c && !c.resolved;
  return (
    <Panel
      title="Conseil du silo"
      onClose={close}
      actions={
        <button className="btn small" disabled={!ready || !!active} onClick={() => send({ type: 'CONVENE_COUNCIL' })} title={ready ? 'Réunir les responsables sur le sujet le plus pressant' : `Prochain conseil possible dans ${Math.ceil(s.councilReadyInHours)} h`}>
          <Icon name="users" size={14} /> {ready ? 'Convoquer le conseil' : `Prochain conseil dans ${Math.ceil(s.councilReadyInHours)} h`}
        </button>
      }
    >
      <RoomThumb room="council" height={96} />
      {!c && <p className="muted" style={{ marginTop: 10 }}>Le conseil ne s’est pas encore réuni. Convoquez-le pour entendre vos responsables sur le sujet le plus pressant : leurs désaccords en disent long sur leurs intérêts.</p>}
      {c && (
        <>
          <h3 style={{ marginTop: 10 }}>Ordre du jour : {c.title}</h3>
          <p className="small muted">{c.summary}</p>
          <div className="council-voices">
            {c.statements.map((st) => (
              <div key={st.officeId} className={`voice ${c.resolved ? (c.resolved === st.proposalId ? 'won' : 'lost') : ''}`}>
                <Portrait portrait={st.portrait} sector={st.sector} look={st.look} size={40} />
                <div>
                  <div className="small muted">
                    {st.title} — {st.name}
                  </div>
                  <div className="small">« {st.text} »</div>
                </div>
              </div>
            ))}
          </div>
          <div className="council-proposals">
            {c.proposals.map((p) => (
              <div key={p.id} className={`card proposal ${c.resolved === p.id ? 'chosen' : ''}`}>
                <strong>{p.label}</strong>
                <div className="small muted">{p.hint}</div>
                <div className="row gap wrap backers">
                  <span className="small muted">Soutiens :</span>
                  {p.backers.length === 0 && <span className="small muted">aucun</span>}
                  {p.backers.map((b) => {
                    const st = portraitOf(b);
                    return st ? <Portrait key={b} portrait={st.portrait} sector={st.sector} look={st.look} size={24} /> : null;
                  })}
                </div>
                {active && (
                  <button className="btn small" onClick={() => send({ type: 'COUNCIL_CHOICE', proposalId: p.id })}>
                    Trancher pour cette option
                  </button>
                )}
              </div>
            ))}
          </div>
          {c.resolved && <p className="small accent">Décision prise. Ceux que vous avez suivis gagnent en loyauté, les autres en perdent.</p>}
          <h4>Alliances et rivalités</h4>
          {c.alliances.map((a, i) => (
            <div key={i} className="small row gap">
              <span className={a.value >= 0 ? 'up' : 'bad'}>{a.value >= 0 ? 'Alliance' : 'Rivalité'}</span>
              <span>
                {a.a} ↔ {a.b}
              </span>
              <span className="muted">({a.value})</span>
            </div>
          ))}
        </>
      )}
    </Panel>
  );
}

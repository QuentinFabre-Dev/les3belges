import { useEffect, useState } from 'react';
import { query, send, useGame } from '../../game/store';
import { TRAIT_LABELS } from '../../sim/data/world';
import type { CitizenDetail, OfficeId, Policies, SectorId } from '../../sim/types';
import { Bar, Icon, Panel, Portrait } from '../common';

const close = () => useGame.getState().setView('global');

const playerName = () => {
  try {
    return localStorage.getItem('silo-01:admin-name') || 'DSI';
  } catch {
    return 'DSI';
  }
};

export function InstitutionsPanel() {
  const s = useGame((g) => g.snapshot)!;
  const selectCitizen = useGame((g) => g.selectCitizen);
  const [appointing, setAppointing] = useState<OfficeId | null>(null);
  const e = s.election;
  return (
    <Panel title="Institutions du silo" onClose={close}>
      <div className="row gap wrap small muted">
        <span>Légitimité de votre gouvernement : {s.psychology.legitimacy}</span>
        <span>Autorité : {s.psychology.authority}</span>
        <span>Confiance moyenne : {s.psychology.trust}</span>
        <span>Peur : {s.psychology.fear}</span>
      </div>
      {e && (
        <div className="card election">
          <div className="row between">
            <strong>Élection : {e.title}</strong>
            <span className="small muted">{e.winnerId !== undefined ? 'Terminée' : `Fin dans ${Math.round(e.endsInHours)} h`}</span>
          </div>
          {e.candidates.map((c) => (
            <div key={c.id} className="row gap candidate">
              <Portrait portrait={c.portrait} size={34} sector="residential" look={c.id} />
              <button className="link grow" onClick={() => selectCitizen(c.id)}>
                {c.name} {e.winnerId === c.id && <span className="tag ok">élu·e</span>}
              </button>
              <div style={{ width: 120 }}>
                <Bar value={c.support} color="var(--accent)" />
              </div>
              <span className="small">{c.support}%</span>
              {e.winnerId === undefined && (
                <button className={`btn small ${e.supportedId === c.id ? 'active' : ''}`} onClick={() => send({ type: 'SUPPORT_CANDIDATE', citizenId: c.id })} title="Soutien discret de la DSI. Peut fuiter.">
                  Soutenir
                </button>
              )}
            </div>
          ))}
          <p className="tiny muted">Sondages issus des intentions de vote des habitants (confiance, proximité, secteur, relations).</p>
        </div>
      )}
      <div className="card office player-office">
        <div className="row gap">
          <Portrait sector="admin" look={7} size={64} />
          <div className="grow">
            <div className="muted small">Directeur·rice des systèmes d’information</div>
            <strong>{playerName()} — vous</strong>
            <p className="small muted">Votre siège n’est sur aucune liste : il ne s’élit pas et ne se nomme pas, il se transmet. Confiance du silo envers la DSI : {s.institutions.find((i) => i.id === 'it')?.trust ?? '—'}.</p>
          </div>
        </div>
      </div>
      <div className="offices">
        {s.offices.map((o) => (
          <div key={o.id} className="card office">
            <div className="row gap">
              <Portrait portrait={o.portrait || undefined} size={64} sector="admin" look={o.holderId ?? 0} />
              <div className="grow">
                <div className="muted small">{o.title}</div>
                {o.holderName ? (
                  <button className="link" onClick={() => selectCitizen(o.holderId)}>
                    <strong>{o.holderName}</strong>
                  </button>
                ) : (
                  <strong className="bad">Vacant</strong>
                )}
                <div className="traits">
                  {o.traits?.map((t) => (
                    <span key={t} className="tag">
                      {TRAIT_LABELS[t]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {o.holderId !== undefined && (
              <div className="grid2 small">
                <span>Compétence {o.skill}</span>
                <span>Leadership {o.leadership}</span>
                <span>Intégrité ~{o.integrity}</span>
                <span>Popularité {o.popularity}</span>
              </div>
            )}
            <div className="meter">
              <span className="muted small">Légitimité</span>
              <Bar value={o.legitimacy} />
              <span className="small">{o.legitimacy}</span>
            </div>
            <div className="row gap">
              {o.succession === 'election' ? (
                <button className="btn small" disabled={!!e && e.winnerId === undefined} onClick={() => send({ type: 'START_ELECTION', officeId: o.id })}>
                  Élection anticipée
                </button>
              ) : (
                <button className="btn small" onClick={() => setAppointing(o.id)}>
                  Nommer
                </button>
              )}
              {o.termEndsDay && <span className="small muted">Mandat jusqu’au jour {o.termEndsDay}</span>}
            </div>
          </div>
        ))}
      </div>
      {appointing && <AppointModal officeId={appointing} onClose={() => setAppointing(null)} />}
    </Panel>
  );
}

function AppointModal({ officeId, onClose }: { officeId: OfficeId; onClose: () => void }) {
  const s = useGame((g) => g.snapshot)!;
  const office = s.offices.find((o) => o.id === officeId)!;
  const [cands, setCands] = useState<CitizenDetail[]>([]);
  useEffect(() => {
    query<CitizenDetail[]>({ type: 'CANDIDATES', officeId }).then(setCands);
  }, [officeId]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <header className="row between">
          <h3>Nommer : {office.title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="x" />
          </button>
        </header>
        <p className="small muted">Aucun candidat n’est parfait : compétence, popularité et intégrité tirent dans des sens différents. Le titulaire actuel ({office.holderName ?? 'vacant'}) sera remplacé.</p>
        {cands.map((c) => (
          <div key={c.id} className="row gap candidate">
            <Portrait sector={c.sector} look={c.look} size={40} />
            <div className="grow">
              <strong>{c.name}</strong>
              <div className="small muted">
                {c.sectorName} · {c.age} ans · {c.traits.map((t) => TRAIT_LABELS[t]).join(', ')}
              </div>
              <div className="small">
                Compétence {c.skill} · Leadership {c.leadership} · Popularité {c.popularity} · Intégrité ~{c.integrity}
              </div>
            </div>
            <button
              className="btn small"
              onClick={() => {
                send({ type: 'APPOINT', officeId, citizenId: c.id });
                onClose();
              }}
            >
              Nommer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const PRIORITY_LABELS: Record<string, string> = {
  medical: 'Médical',
  water: 'Eau',
  mechanical: 'Mécanique & ventilation',
  admin: 'Administration & DSI',
  agriculture: 'Agriculture',
  security: 'Sécurité',
  energy: 'Énergie',
  supplies: 'Fournitures',
  mines: 'Mines',
  residential: 'Résidentiel',
};

export function PoliciesPanel() {
  const s = useGame((g) => g.snapshot)!;
  const p = s.policies;
  const setP = <K extends keyof Policies>(key: K, value: Policies[K]) => send({ type: 'SET_POLICY', key, value });
  const move = (i: number, d: number) => {
    const list = [...p.powerPriority];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setP('powerPriority', list);
  };
  return (
    <Panel title="Politiques & gouvernance" onClose={close}>
      <div className="policy-grid">
        <div className="card">
          <h4>Rations</h4>
          <div className="seg">
            {(['reduced', 'normal', 'generous'] as const).map((v) => (
              <button key={v} className={p.rations === v ? 'active' : ''} onClick={() => setP('rations', v)}>
                {v === 'reduced' ? 'Réduites (−20 %)' : v === 'normal' ? 'Normales' : 'Généreuses (+15 %)'}
              </button>
            ))}
          </div>
          <p className="tiny muted">Réduire préserve les stocks mais use le moral et accumule de la rancœur.</p>
        </div>
        <div className="card">
          <h4>Loterie des naissances</h4>
          <div className="seg">
            {(['restricted', 'normal', 'expanded'] as const).map((v) => (
              <button key={v} className={(p.births ?? 'normal') === v ? 'active' : ''} onClick={() => setP('births', v)}>
                {v === 'restricted' ? 'Restreinte' : v === 'normal' ? 'Ordinaire' : 'Élargie'}
              </button>
            ))}
          </div>
          <p className="tiny muted">Article IV du Pacte. Plus de naissances : un silo qui se renouvelle, mais plus de bouches à nourrir et des logements qui se remplissent.</p>
        </div>
        <div className="card">
          <h4>Temps de travail</h4>
          <div className="seg">
            <button className={!p.extendedHours ? 'active' : ''} onClick={() => setP('extendedHours', false)}>
              Normal
            </button>
            <button className={p.extendedHours ? 'active' : ''} onClick={() => setP('extendedHours', true)}>
              Prolongé (+15 %)
            </button>
          </div>
          <p className="tiny muted">Production + mais fatigue, usure des machines et accidents miniers.</p>
        </div>
        <div className="card">
          <h4>Quota minier : ×{p.mineQuota.toFixed(2)}</h4>
          <input type="range" min={0.7} max={1.4} step={0.05} value={p.mineQuota} onChange={(e) => setP('mineQuota', Number(e.target.value))} />
          <p className="tiny muted">Plus de fer pour les pièces, mais le risque d’accident croît très vite.</p>
        </div>
        <div className="card">
          <h4>Équipes de nettoyage</h4>
          <div className="seg">
            {(['low', 'normal', 'high'] as const).map((v) => (
              <button key={v} className={p.cleaning === v ? 'active' : ''} onClick={() => setP('cleaning', v)}>
                {v === 'low' ? 'Réduites' : v === 'normal' ? 'Normales' : 'Renforcées'}
              </button>
            ))}
          </div>
          <p className="tiny muted">Négliger la salubrité crée des problèmes progressifs : odeurs, nuisibles, contamination.</p>
        </div>
        <div className="card">
          <h4>Transparence</h4>
          <div className="seg">
            {(['low', 'normal', 'high'] as const).map((v) => (
              <button key={v} className={p.transparency === v ? 'active' : ''} onClick={() => setP('transparency', v)}>
                {v === 'low' ? 'Faible' : v === 'normal' ? 'Normale' : 'Élevée'}
              </button>
            ))}
          </div>
          <p className="tiny muted">La vérité rassure à long terme, mais amplifie la peur sur le moment.</p>
        </div>
        <div className="card">
          <h4>Pouvoirs d’urgence</h4>
          <div className="seg">
            <button className={!p.emergencyPowers ? 'active' : ''} onClick={() => setP('emergencyPowers', false)}>
              Inactifs
            </button>
            <button className={p.emergencyPowers ? 'active' : ''} onClick={() => setP('emergencyPowers', true)}>
              Actifs
            </button>
          </div>
          <p className="tiny muted">Autorité + immédiate, légitimité qui s’érode tant qu’ils durent.</p>
        </div>
      </div>
      <div className="policy-grid">
        <div className="card">
          <h4>Priorités de délestage énergétique</h4>
          <p className="tiny muted">En cas de déficit, les secteurs du bas de la liste sont coupés en premier. Couper le résidentiel est rationnel… et impopulaire.</p>
          {p.powerPriority.map((sid, i) => (
            <div key={sid} className="row gap prio">
              <span className="muted">{i + 1}.</span>
              <span className="grow">{PRIORITY_LABELS[sid] ?? sid}</span>
              <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Monter">
                ▲
              </button>
              <button className="icon-btn" onClick={() => move(i, 1)} aria-label="Descendre">
                ▼
              </button>
            </div>
          ))}
          <div className="small muted">
            Production {s.energy.production} kW · Demande {s.energy.demand} kW · Batteries {s.energy.battery} %
          </div>
        </div>
        <div className="card">
          <h4>Affectation du personnel</h4>
          <p className="tiny muted">Les renforts viennent des sans-affectation : ils débutent moins compétents.</p>
          {s.sectors.map((x) => (
            <div key={x.id} className="row gap prio">
              <span className="grow">{x.name}</span>
              <span className={x.staffing < x.target * 0.85 ? 'warn' : 'muted'}>
                {x.staffing}/{x.target}
              </span>
              <button className="icon-btn" onClick={() => send({ type: 'SET_STAFFING', sector: x.id as SectorId, delta: -5 })} aria-label="Retirer 5">
                −
              </button>
              <button className="icon-btn" onClick={() => send({ type: 'SET_STAFFING', sector: x.id as SectorId, delta: 5 })} aria-label="Ajouter 5">
                +
              </button>
            </div>
          ))}
        </div>
        <div className="card">
          <h4>Communication officielle</h4>
          <p className="tiny muted">L’effet dépend de la crédibilité du maire et de ce qui se passe ensuite.</p>
          <div className="col gap">
            <button className="btn" onClick={() => send({ type: 'COMMUNICATE', style: 'truth' })}>
              <Icon name="megaphone" size={14} /> Dire la vérité
            </button>
            <button className="btn" onClick={() => send({ type: 'COMMUNICATE', style: 'reassure' })}>
              Rassurer (crée une promesse en crise)
            </button>
            <button className="btn" onClick={() => send({ type: 'COMMUNICATE', style: 'blame' })}>
              Désigner un responsable
            </button>
            <button className="btn" onClick={() => send({ type: 'COMMUNICATE', style: 'silence' })}>
              Garder le silence
            </button>
          </div>
          <h4>Audits</h4>
          <div className="row gap wrap">
            {(['supplies', 'maintenance', 'mines', 'security'] as const).map((t) => (
              <button key={t} className="btn small" onClick={() => send({ type: 'AUDIT', target: t })}>
                {t === 'supplies' ? 'Fournitures' : t === 'maintenance' ? 'Maintenance' : t === 'mines' ? 'Mines' : 'Sécurité'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

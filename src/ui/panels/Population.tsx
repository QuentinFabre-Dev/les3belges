import { useEffect, useState } from 'react';
import { query, send, useGame } from '../../game/store';
import { TRAIT_LABELS } from '../../sim/data/world';
import type { CitizenDetail, CitizenSummary, SectorId } from '../../sim/types';
import { Bar, Panel, Portrait } from '../common';

const close = () => useGame.getState().setView('global');
const REL: Record<string, string> = { partner: 'Conjoint·e', parent: 'Parent de', child: 'Enfant de', sibling: 'Frère/sœur', friend: 'Ami·e', coworker: 'Collègue', rival: 'Rival·e' };
const LIFE: Record<string, string> = { alive: '', dead: '✝', imprisoned: '⛓', missing: '?' };

export function PopulationPanel() {
  const s = useGame((g) => g.snapshot)!;
  const selected = useGame((g) => g.selectedCitizen);
  const selectCitizen = useGame((g) => g.selectCitizen);
  const [search, setSearch] = useState('');
  const [keyOnly, setKeyOnly] = useState(true);
  const [sector, setSector] = useState<SectorId | ''>('');
  const [list, setList] = useState<{ total: number; items: CitizenSummary[] }>({ total: 0, items: [] });

  useEffect(() => {
    let live = true;
    query<{ total: number; items: CitizenSummary[] }>({ type: 'CITIZENS', keyOnly, search: search || undefined, sector: sector || undefined, offset: 0, limit: 60 }).then((r) => live && setList(r));
    return () => {
      live = false;
    };
  }, [search, keyOnly, sector, s.day, s.hour]);

  return (
    <Panel title={`Population — ${s.population.toLocaleString('fr-FR')} habitants`} onClose={close}>
      <div className="pop-layout">
        <div className="pop-list">
          <div className="row gap wrap">
            <input className="input" placeholder="Rechercher un nom…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input" value={sector} onChange={(e) => setSector(e.target.value as SectorId)}>
              <option value="">Tous secteurs</option>
              {s.sectors.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
              <option value="residential">Sans affectation</option>
            </select>
            <label className="row gap small">
              <input type="checkbox" checked={keyOnly} onChange={(e) => setKeyOnly(e.target.checked)} /> Habitants suivis
            </label>
          </div>
          <div className="muted small">{list.total} résultat(s)</div>
          <div className="scroll">
            {list.items.map((c) => (
              <button key={c.id} className={`list-row ${selected === c.id ? 'sel' : ''}`} onClick={() => selectCitizen(c.id)}>
                <Portrait portrait={c.portrait} sector={c.sector} look={c.look} size={32} />
                <span className="grow">
                  <span>
                    {c.name} {LIFE[c.lifeState]}
                  </span>
                  <small className="muted">
                    {c.officeTitle ? <span className="accent">{c.officeTitle} · </span> : null}
                    {c.sectorName} · {c.age} ans
                  </small>
                </span>
                <small className={c.morale < 35 ? 'bad' : 'muted'}>{c.morale}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="pop-detail">{selected !== undefined ? <CitizenCard id={selected} /> : <p className="muted">Sélectionnez un habitant, ou cliquez sur un habitant dans le silo.</p>}</div>
      </div>
    </Panel>
  );
}

export function CitizenCard({ id }: { id: number }) {
  const s = useGame((g) => g.snapshot)!;
  const selectCitizen = useGame((g) => g.selectCitizen);
  const [c, setC] = useState<CitizenDetail | null>(null);
  useEffect(() => {
    let live = true;
    query<CitizenDetail | null>({ type: 'CITIZEN', id }).then((r) => live && setC(r));
    return () => {
      live = false;
    };
  }, [id, s.tick - (s.tick % 6)]);
  if (!c) return null;
  const home = s.floors.find((f) => f.id === c.homeFloor);
  const work = s.floors.find((f) => f.id === c.workFloor);
  const act = (action: 'arrest' | 'release' | 'reward' | 'protect' | 'investigate' | 'dismiss') => send({ type: 'CITIZEN_ACTION', citizenId: c.id, action });
  const stats: [string, number, boolean?][] = [
    ['Santé', c.health],
    ['Fatigue', c.fatigue, true],
    ['Moral', c.morale],
    ['Peur', c.fear, true],
    ['Colère', c.anger, true],
    ['Rancœur', c.grievance, true],
    ['Confiance admin.', c.trust],
  ];
  return (
    <div className="citizen">
      <div className="row gap">
        <Portrait portrait={c.portrait} sector={c.sector} look={c.look} size={84} />
        <div>
          <h3>
            {c.name} {LIFE[c.lifeState]}
          </h3>
          {c.officeTitle && <div className="accent">{c.officeTitle}</div>}
          <div className="small muted">
            {c.age} ans · {c.sectorName}
          </div>
          <div className="small muted">
            Habite {home?.label} {home?.name} · travaille {work?.label} {work?.name}
          </div>
          <div className="small">Activité : {c.routine}</div>
        </div>
      </div>
      <div className="traits">
        {c.traits.map((t) => (
          <span key={t} className="tag">
            {TRAIT_LABELS[t]}
          </span>
        ))}
      </div>
      <div className="grid3">
        <div className="kv">
          <span className="muted">Compétence</span>
          <span>{c.skill}</span>
        </div>
        <div className="kv">
          <span className="muted">Leadership</span>
          <span>{c.leadership}</span>
        </div>
        <div className="kv">
          <span className="muted">Intégrité (est.)</span>
          <span>{c.integrity}</span>
        </div>
        <div className="kv">
          <span className="muted">Popularité</span>
          <span>{c.popularity}</span>
        </div>
        <div className="kv">
          <span className="muted">Influence</span>
          <span>{c.influence}</span>
        </div>
      </div>
      {stats.map(([label, v, inverse]) => (
        <div key={label} className="meter">
          <span className="muted">{label}</span>
          <Bar value={inverse ? 100 - v : v} />
          <span>{v}</span>
        </div>
      ))}
      {c.lifeState !== 'dead' && (
        <div className="row gap wrap actions">
          {c.lifeState === 'alive' && (
            <>
              <button className="btn small" onClick={() => useGame.getState().setFollowed(c.id)} title="Vue Personne : suivre sa journée dans le silo">
                Suivre dans le silo
              </button>
              <button className="btn small" onClick={() => act('reward')} title="Moral et popularité + pour lui et ses proches">
                Récompenser
              </button>
              <button className="btn small" onClick={() => act('investigate')} title="Le shérif enquête : peut révéler un vol">
                Enquêter
              </button>
              <button className="btn small" onClick={() => act('protect')}>
                Protéger
              </button>
              <button className="btn small danger" onClick={() => act('arrest')} title="Sans dossier, l’arrestation sera perçue comme arbitraire">
                Arrêter
              </button>
              {c.officeTitle && s.offices.some((o) => o.holderId === c.id) && (
                <button className="btn small danger" onClick={() => act('dismiss')}>
                  Révoquer
                </button>
              )}
            </>
          )}
          {c.lifeState === 'imprisoned' && (
            <button className="btn small" onClick={() => act('release')}>
              Libérer
            </button>
          )}
        </div>
      )}
      {c.household.length > 0 && (
        <>
          <h4>Foyer</h4>
          {c.household.map((h) => (
            <button key={h.id} className="link block" onClick={() => selectCitizen(h.id)}>
              {h.name} ({h.age} ans) {LIFE[h.lifeState]}
            </button>
          ))}
        </>
      )}
      <h4>Relations</h4>
      <div className="relations">
        {c.relations.map((r) => (
          <button key={r.id} className="rel" onClick={() => selectCitizen(r.id)}>
            <span className="muted small">{REL[r.type]}</span>
            <span>
              {r.name} {LIFE[r.lifeState]}
            </span>
            <span className="rel-bar" style={{ width: `${Math.round(r.strength * 100)}%`, background: r.type === 'rival' ? 'var(--bad)' : 'var(--accent)' }} />
          </button>
        ))}
      </div>
      {c.memories.length > 0 && (
        <>
          <h4>Souvenirs marquants</h4>
          {c.memories
            .slice()
            .reverse()
            .map((m, k) => (
              <div key={k} className="small">
                <span className="muted">Jour {m.day} — </span>
                {m.text} {m.trustDelta < 0 && <span className="bad">(confiance {m.trustDelta})</span>}
              </div>
            ))}
        </>
      )}
    </div>
  );
}

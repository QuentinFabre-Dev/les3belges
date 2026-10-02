import { useState } from 'react';
import { DIFFICULTY } from '../../sim/data/difficulty';
import { START_YEAR, YEAR_DAYS } from '../../sim/data/world';
import { ChronicleList, NewGameDialog } from '../Chronicle';
import { send, useGame } from '../../game/store';
import { Bar, Icon, Panel, Sparkline, fmt, severityColor, severityLabel, signed } from '../common';
import { DecisionCard } from '../RightPanel';

const close = () => useGame.getState().setView('global');
const UNREST = ['Calme', 'Mécontentement', 'Plaintes', 'Protestation', 'Émeute', 'Insurrection'];

export function FloorsPanel() {
  const s = useGame((g) => g.snapshot)!;
  const selected = useGame((g) => g.selectedFloor);
  const selectFloor = useGame((g) => g.selectFloor);
  return (
    <Panel title="Étage par étage" onClose={close}>
      <table className="table">
        <thead>
          <tr>
            <th>Étage</th>
            <th>Présents</th>
            <th>Personnel</th>
            <th>Énergie</th>
            <th>Propreté</th>
            <th>Moral</th>
            <th>Climat</th>
            <th>Accès</th>
          </tr>
        </thead>
        <tbody>
          {s.floors.map((f) => {
            const sec = s.sectors.find((x) => x.id === f.sector);
            return (
              <tr key={f.id} className={`clickable ${selected === f.id ? 'sel' : ''}`} onClick={() => selectFloor(f.id, true)}>
                <td>
                  <span className="dot" style={{ background: f.alert === 'critical' ? 'var(--bad)' : f.alert === 'warning' ? 'var(--warn)' : 'var(--ok)' }} /> {f.label} {f.name}
                </td>
                <td>{f.present}</td>
                <td>{sec ? `${sec.staffing}/${sec.target}` : '—'}</td>
                <td>
                  <Bar value={f.power * 100} />
                </td>
                <td>
                  <Bar value={f.cleanliness} />
                </td>
                <td>{f.morale}</td>
                <td className={f.unrest >= 3 ? 'bad' : f.unrest >= 1 ? 'warn' : 'muted'}>{UNREST[f.unrest]}</td>
                <td>{f.lockdown === 'open' ? 'Ouvert' : f.lockdown === 'controlled' ? 'Contrôlé' : <span className="bad">Blocus</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Cliquez sur un étage pour le centrer dans la vue. Les valeurs de climat social sont rapportées par les responsables d’étage.</p>
    </Panel>
  );
}

export function ResourcesPanel() {
  const s = useGame((g) => g.snapshot)!;
  const h = s.history;
  return (
    <Panel
      title="Ressources"
      onClose={close}
      actions={
        <button className="btn small" onClick={() => send({ type: 'AUDIT', target: 'supplies' })} title="Révèle les stocks réels (vol, erreurs). Ralentit le dépôt.">
          Auditer les stocks
        </button>
      }
    >
      <div className="cards">
        {s.resources.map((r) => (
          <div key={r.key} className="card">
            <div className="row between">
              <strong>{r.label}</strong>
              <span className={r.pct < 25 ? 'bad' : r.pct < 45 ? 'warn' : ''}>{r.pct}%</span>
            </div>
            <Bar value={r.pct} />
            {r.key === 'energy' ? (
              <div className="small muted">
                Production {r.stock} kW · Demande {r.capacity} kW · Batteries {Math.round(r.days)} %
              </div>
            ) : (
              <div className="small muted">
                {fmt(r.stock)} / {fmt(r.capacity)} · flux {signed(r.trend)}/j · autonomie {r.days.toFixed(1)} j
              </div>
            )}
            {['food', 'water', 'materials', 'energy'].includes(r.key) && <Sparkline data={h.map((x) => x[r.key as 'food'])} width={220} />}
          </div>
        ))}
      </div>
      <h3>Chaîne de dépendances</h3>
      <p className="small muted">
        Énergie → Pompes → Eau → Agriculture → Nourriture → Moral → Stabilité. Mines → Fer → Ateliers → Pièces → Maintenance → Infrastructures. Les stocks affichés sont ceux des registres : seul un audit révèle les pertes.
      </p>
      <h3>Secteurs</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Secteur</th>
            <th>Effectif</th>
            <th>Efficacité</th>
            <th>Moral</th>
            <th>Cohésion</th>
            <th>Risque de grève</th>
          </tr>
        </thead>
        <tbody>
          {s.sectors.map((x) => (
            <tr key={x.id}>
              <td>{x.name}</td>
              <td>
                {x.staffing}/{x.target}
              </td>
              <td>{Math.round(x.efficiency * 100)}%</td>
              <td>{x.morale}</td>
              <td>{Math.round(x.cohesion * 100)}%</td>
              <td className={x.strikeRisk > 30 ? 'bad' : x.strikeRisk > 10 ? 'warn' : 'muted'}>{x.strikeRisk}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function InfrastructurePanel() {
  const s = useGame((g) => g.snapshot)!;
  const floorName = (id: string) => {
    const f = s.floors.find((x) => x.id === id);
    return f ? `${f.label} ${f.name}` : id;
  };
  return (
    <Panel
      title="Infrastructure"
      onClose={close}
      actions={
        <button className="btn small" onClick={() => send({ type: 'AUDIT', target: 'maintenance' })}>
          Audit maintenance
        </button>
      }
    >
      <p className="small muted">
        États estimés par les capteurs (fiabilité {Math.round(s.infoAccuracy * 100)} %). Les mécaniciens répartissent la maintenance préventive sur les équipements les plus usés, sauf priorité imposée.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Équipement</th>
            <th>Étage</th>
            <th>État</th>
            <th>Risque</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {s.assets.map((a) => (
            <tr key={a.id}>
              <td>
                {a.critical && <span className="tag bad">vital</span>} {a.name}
              </td>
              <td className="muted">{floorName(a.floor)}</td>
              <td style={{ minWidth: 140 }}>
                {a.state === 'failed' ? (
                  <span className="bad">EN PANNE {a.repairProgress > 0 ? `· réparation ${Math.round(a.repairProgress * 100)} %` : ''}</span>
                ) : a.state === 'maintenance' ? (
                  <span className="warn">Maintenance {Math.round(a.repairProgress * 100)} %</span>
                ) : (
                  <div className="row gap">
                    <Bar value={a.condition * 100} />
                    <span>{Math.round(a.condition * 100)}%</span>
                  </div>
                )}
              </td>
              <td className={a.risk === 'faible' ? 'muted' : a.risk === 'moyen' ? 'warn' : 'bad'}>{a.risk}</td>
              <td className="row gap">
                <button className="btn small" onClick={() => send({ type: 'SEND_REPAIR', assetId: a.id })} title={a.state === 'failed' ? 'Réparation prioritaire (×1.8)' : 'Arrêt pour maintenance complète (pièces requises, équipement indisponible)'}>
                  {a.state === 'failed' ? 'Prioriser' : 'Maintenance'}
                </button>
                <button
                  className={`btn small ${s.policies.maintenanceFocus === a.id ? 'active' : ''}`}
                  onClick={() => send({ type: 'SET_POLICY', key: 'maintenanceFocus', value: s.policies.maintenanceFocus === a.id ? 'auto' : a.id })}
                  title="Concentrer 60 % de la maintenance préventive"
                >
                  Focus
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function IncidentsPanel() {
  const s = useGame((g) => g.snapshot)!;
  const selectFloor = useGame((g) => g.selectFloor);
  return (
    <Panel title="Incidents" onClose={close}>
      {s.incidents.length === 0 && <p className="muted">Aucun incident.</p>}
      {s.incidents.map((i) => (
        <div key={i.id} className={`incident ${i.status}`}>
          <div className="row between">
            <div className="row gap">
              <Icon name="alert" color={severityColor(i.severity)} />
              <strong>{i.title}</strong>
            </div>
            <span className="small muted">
              {severityLabel(i.severity)} · {i.status === 'resolved' ? 'résolu' : 'actif'} · {i.ageHours < 24 ? `${Math.round(i.ageHours)} h` : `${Math.round(i.ageHours / 24)} j`}
            </span>
          </div>
          {i.causes.length > 0 && (
            <div className="causes">
              <span className="muted small">Chaîne causale :</span>
              {i.causes.map((c, k) => (
                <div key={k} className="cause">
                  ↳ {c}
                </div>
              ))}
            </div>
          )}
          {i.floor && (
            <button className="link small" onClick={() => selectFloor(i.floor, true)}>
              Voir l’étage {i.floorLabel}
            </button>
          )}
        </div>
      ))}
    </Panel>
  );
}

export function DecisionsPanel() {
  const s = useGame((g) => g.snapshot)!;
  return (
    <Panel title={`Décisions (${s.decisions.length})`} onClose={close}>
      {s.decisions.length === 0 && <p className="muted">Aucune décision en attente.</p>}
      <div className="decision-grid">
        {s.decisions.map((d) => (
          <DecisionCard key={d.uid} d={d} />
        ))}
      </div>
    </Panel>
  );
}

export function MessagesPanel() {
  const s = useGame((g) => g.snapshot)!;
  const selectCitizen = useGame((g) => g.selectCitizen);
  const msgs = s.messages.slice().reverse();
  return (
    <Panel title="Messages des responsables" onClose={close}>
      <p className="small muted">Les responsables rapportent ce qu’ils voient… ou ce qu’ils veulent que vous voyiez.</p>
      {msgs.map((m) => (
        <div key={m.id} className={`message ${m.read ? '' : 'unread'}`} onMouseEnter={() => !m.read && send({ type: 'MARK_READ', messageId: m.id })}>
          <div className="row between">
            <strong>{m.subject}</strong>
            <span className="small muted">Jour {Math.floor((m.tick + 36) / 144) + 1}</span>
          </div>
          <div className="small accent">
            {m.fromId !== undefined ? (
              <button className="link" onClick={() => selectCitizen(m.fromId)}>
                {m.fromTitle}
              </button>
            ) : (
              m.fromTitle
            )}
          </div>
          <p className="small">{m.body}</p>
        </div>
      ))}
    </Panel>
  );
}

export function JournalPanel() {
  const s = useGame((g) => g.snapshot)!;
  const entries = s.journal.slice().reverse();
  return (
    <Panel title="Journal du silo" onClose={close}>
      <h3>Mémoire collective</h3>
      <ChronicleList />
      <h3>Journal</h3>
      {entries.map((j, k) => {
        const d = Math.floor((j.tick + 36) / 144); // jours écoulés depuis la prise de fonction
        const min = ((j.tick + 36) % 144) * 10;
        return (
          <div key={k} className="journal-row">
            <span className="muted mono">
              An {START_YEAR + Math.floor(d / YEAR_DAYS)} J{(d % YEAR_DAYS) + 1} {String(Math.floor(min / 60)).padStart(2, '0')}:{String(min % 60).padStart(2, '0')}
            </span>
            <span className="dot" style={{ background: severityColor(j.severity) }} />
            <span>{j.text}</span>
          </div>
        );
      })}
    </Panel>
  );
}

export function SettingsPanel() {
  const s = useGame((g) => g.snapshot)!;
  const [newGame, setNewGame] = useState(false);
  const settings = useGame((g) => g.settings);
  const set = useGame((g) => g.setSettings);
  return (
    <Panel title="Paramètres" onClose={close}>
      <h3>Partie</h3>
      <div className="row gap wrap">
        <button className="btn" onClick={() => send({ type: 'SAVE' })}>
          Sauvegarder
        </button>
        <button className="btn" onClick={() => send({ type: 'LOAD' })}>
          Charger
        </button>
        <button className="btn danger" onClick={() => setNewGame(true)}>
          Nouvelle partie
        </button>
      </div>
      {newGame && <NewGameDialog onClose={() => setNewGame(false)} />}
      <p className="small muted">
        Difficulté : {DIFFICULTY[s.difficulty].label} — {DIFFICULTY[s.difficulty].summary} Mandat : année {s.calendar.mandateYear} sur {s.calendar.mandateYears}
        {s.calendar.freeMode ? ' (partie libre)' : ''}.
      </p>
      <p className="small muted">Sauvegarde automatique chaque jour de jeu (IndexedDB, dans ce navigateur).</p>
      <div className="row gap wrap">
        <button className="btn" onClick={() => useGame.getState().setPhase('intro')}>
          Revoir l’introduction
        </button>
        <button
          className="btn"
          onClick={() => {
            send({ type: 'SET_SPEED', speed: 0 });
            useGame.getState().setView('global');
            useGame.getState().setPhase('tutorial');
          }}
        >
          Relancer le tutoriel
        </button>
      </div>
      <h3>Son</h3>
      <div className="row gap wrap" style={{ alignItems: 'center' }}>
        <button className={`btn small ${settings.muted ? 'active' : ''}`} onClick={() => set({ muted: !settings.muted })}>
          {settings.muted ? 'Son coupé' : 'Couper le son'}
        </button>
        <label className="row gap small" style={{ alignItems: 'center' }}>
          Volume
          <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => set({ volume: Number(e.target.value) })} aria-label="Volume" />
        </label>
      </div>
      <p className="small muted">Bourdonnement de la génératrice (qui s’arrête net en cas de panne), ventilation, rumeur des étages en colère, gouttes, alarmes. Tout est synthétisé en direct.</p>
      <h3>Graphismes</h3>
      <label className="field">
        <span>Densité d’habitants visibles</span>
        <div className="seg">
          {[
            [75, 'Faible'],
            [150, 'Moyenne'],
            [250, 'Élevée'],
            [400, 'Très élevée'],
          ].map(([v, l]) => (
            <button key={v} className={settings.density === v ? 'active' : ''} onClick={() => set({ density: v as number })}>
              {l}
            </button>
          ))}
        </div>
      </label>
      <label className="field">
        <span>Animations secondaires (étincelles, bulles, clignotements)</span>
        <div className="seg">
          {(['min', 'standard', 'max'] as const).map((v) => (
            <button key={v} className={settings.secondary === v ? 'active' : ''} onClick={() => set({ secondary: v })}>
              {v === 'min' ? 'Minimum' : v === 'standard' ? 'Standard' : 'Maximum'}
            </button>
          ))}
        </div>
      </label>
      <label className="field">
        <span>Éclairage</span>
        <div className="seg">
          {(['low', 'medium', 'high'] as const).map((v) => (
            <button key={v} className={settings.lighting === v ? 'active' : ''} onClick={() => set({ lighting: v })}>
              {v === 'low' ? 'Bas' : v === 'medium' ? 'Moyen' : 'Élevé'}
            </button>
          ))}
        </div>
      </label>
      <label className="field row gap">
        <input type="checkbox" checked={settings.adaptive} onChange={(e) => set({ adaptive: e.target.checked })} />
        <span>Dégradation adaptative (réduit les effets puis la densité si les FPS chutent)</span>
      </label>
    </Panel>
  );
}

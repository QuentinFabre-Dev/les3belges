import { send, useGame } from '../game/store';
import type { LockdownLevel } from '../sim/types';
import { Bar, Icon, RoomThumb } from './common';

const UNREST = ['Calme', 'Mécontentement', 'Plaintes', 'Protestation', 'Émeute', 'Insurrection'];
const DESCRIPTIONS: Record<string, string> = {
  admin: 'Bureaux du maire, archives et salle des serveurs de la DSI.',
  security: 'Bureau du shérif, vestiaires des adjoints et cellules de détention.',
  residential: 'Logements, couloirs et espaces communs des familles.',
  agriculture: 'Fermes hydroponiques : la nourriture de tout le silo.',
  medical: 'Infirmerie, lits et réserve de médicaments.',
  mechanical: 'Ateliers, forge et ventilation centrale. Le cœur technique du silo.',
  water: 'Station de pompage et de filtration de l’eau.',
  energy: 'La génératrice principale : sans elle, le silo s’éteint.',
  supplies: 'Dépôt central des fournitures et des pièces détachées.',
  mines: 'Galeries d’extraction du fer. Productives, mais dangereuses.',
};

export function FloorCard() {
  const s = useGame((g) => g.snapshot);
  const id = useGame((g) => g.selectedFloor);
  const selectFloor = useGame((g) => g.selectFloor);
  const setView = useGame((g) => g.setView);
  const f = s?.floors.find((x) => x.id === id);
  if (!s || !f) return null;
  const assets = s.assets.filter((a) => a.floor === f.id);
  const sector = s.sectors.find((x) => x.id === f.sector);
  const setLock = (level: LockdownLevel) => send({ type: 'SET_LOCKDOWN', floor: f.id, level });
  return (
    <div className="floor-card panel">
      <header>
        <h3>
          {f.label} {f.name}
        </h3>
        <button className="icon-btn" onClick={() => selectFloor(undefined)} aria-label="Fermer">
          <Icon name="x" />
        </button>
      </header>
      <RoomThumb room={f.left} height={74} />
      <p className="small muted">
        {f.cafeteria === 'main'
          ? 'Le grand réfectoire. Sur l’écran géant, la surface telle que la voient les capteurs : morte, mais visible. Tout le silo vient y regarder.'
          : f.cafeteria === 'relay'
            ? 'Réfectoire des étages profonds. Un écran relais retransmet la vue des capteurs extérieurs.'
            : DESCRIPTIONS[f.sector]}
      </p>
      {f.cafeteria && (
        <div className="meter">
          <span className="muted">Netteté écran</span>
          <Bar value={s.lens * 100} />
          <span>{Math.round(s.lens * 100)}%</span>
        </div>
      )}
      <div className="grid2">
        <div className="kv">
          <span className="muted">Présents</span>
          <span>{f.present}</span>
        </div>
        <div className="kv">
          <span className="muted">Résidents</span>
          <span>{f.residents}</span>
        </div>
        {sector && (
          <div className="kv">
            <span className="muted">Personnel</span>
            <span>
              {sector.staffing}/{sector.target}
            </span>
          </div>
        )}
        <div className="kv">
          <span className="muted">Responsable</span>
          <span className="ellipsis">{f.managerName ?? '—'}</span>
        </div>
      </div>
      <div className="meter">
        <span className="muted">Énergie</span>
        <Bar value={f.power * 100} />
        <span>{Math.round(f.power * 100)}%</span>
      </div>
      <div className="meter">
        <span className="muted">Propreté</span>
        <Bar value={f.cleanliness} />
        <span>{f.cleanliness}%</span>
      </div>
      <div className="meter">
        <span className="muted">Moral</span>
        <Bar value={f.morale} />
        <span>{f.morale}</span>
      </div>
      <div className="meter">
        <span className="muted">Colère*</span>
        <Bar value={100 - f.anger} />
        <span>{f.anger}</span>
      </div>
      <div className="row between small">
        <span className={f.unrest >= 3 ? 'bad' : f.unrest >= 1 ? 'warn' : 'muted'}>Climat : {UNREST[f.unrest]}</span>
        <span className="muted">Confiance {f.trust}</span>
      </div>
      {assets.map((a) => (
        <div key={a.id} className="meter">
          <span className="muted ellipsis">{a.name}</span>
          <Bar value={a.condition * 100} />
          <span className={a.state === 'failed' ? 'bad' : ''}>{a.state === 'failed' ? 'PANNE' : a.state === 'maintenance' ? 'MAINT.' : `${Math.round(a.condition * 100)}%`}</span>
        </div>
      ))}
      <div className="seg" role="group" aria-label="Contrôle des accès">
        {(['open', 'controlled', 'full'] as LockdownLevel[]).map((l) => (
          <button key={l} className={f.lockdown === l ? 'active' : ''} onClick={() => setLock(l)}>
            {l === 'open' ? 'Ouvert' : l === 'controlled' ? 'Contrôlé' : 'Blocus'}
          </button>
        ))}
      </div>
      <div className="row gap">
        <button className="btn small" onClick={() => useGame.getState().selectRoom(f.id, 'left', true)} title="Vue Salle">
          Salle ouest
        </button>
        <button className="btn small" onClick={() => useGame.getState().selectRoom(f.id, 'right', true)} title="Vue Salle">
          Salle est
        </button>
        <button className="btn small" onClick={() => setView('floors')}>
          Détails
        </button>
        {f.managerId !== undefined && (
          <button className="btn small" onClick={() => useGame.getState().selectCitizen(f.managerId)}>
            Responsable
          </button>
        )}
      </div>
      <p className="tiny muted">* rapporté par le responsable d’étage, peut être minimisé.</p>
    </div>
  );
}

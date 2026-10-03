import { useEffect, useState } from 'react';
import { query, useGame } from '../game/store';
import type { CitizenDetail, RoomDetail } from '../sim/types';
import { Bar, Icon, Portrait, RoomThumb } from './common';

// Vue Salle : qui est là, ce qu'on y fait, les équipements.
export function RoomCard() {
  const room = useGame((g) => g.selectedRoom);
  const s = useGame((g) => g.snapshot);
  const selectRoom = useGame((g) => g.selectRoom);
  const selectCitizen = useGame((g) => g.selectCitizen);
  const [d, setD] = useState<RoomDetail | null>(null);
  useEffect(() => {
    if (!room) return;
    let live = true;
    query<RoomDetail | null>({ type: 'ROOM', floor: room.floor, side: room.side }).then((r) => live && setD(r));
    return () => {
      live = false;
    };
  }, [room?.floor, room?.side, s?.hour]);
  if (!room || !d) return null;
  return (
    <div className="floor-card panel room-card">
      <header>
        <h3>{d.title}</h3>
        <button className="icon-btn" onClick={() => selectRoom(undefined)} aria-label="Fermer">
          <Icon name="x" />
        </button>
      </header>
      <div className="small muted">
        {d.floorLabel} {d.floorName} · salle {d.side === 'left' ? 'ouest' : 'est'}
      </div>
      <RoomThumb room={d.texture} height={92} />
      <p className="small">{d.description}</p>
      {d.facts.map((f, i) => (
        <div key={i} className="small accent">
          ↳ {f}
        </div>
      ))}
      {d.assets.map((a) => (
        <div key={a.id} className="meter">
          <span className="muted ellipsis">{a.name}</span>
          <Bar value={a.condition * 100} />
          <span className={a.state === 'failed' ? 'bad' : ''}>{a.state === 'failed' ? 'PANNE' : `${Math.round(a.condition * 100)}%`}</span>
        </div>
      ))}
      <h4>
        Présents ({d.total}) — {String(s?.hour ?? 0).padStart(2, '0')}h
      </h4>
      {d.total === 0 && <p className="small muted">Personne pour l’instant.</p>}
      <div className="occupants">
        {d.occupants.map((o) => (
          <button key={o.id} className="list-row" onClick={() => selectCitizen(o.id)}>
            <Portrait portrait={o.portrait} sector={o.sector} look={o.look} size={26} />
            <span className="grow">
              <span className="small">{o.name}</span>
              <small className="muted">
                {o.officeTitle ? <span className="accent">{o.officeTitle} · </span> : null}
                {o.label}
              </small>
            </span>
          </button>
        ))}
        {d.total > d.occupants.length && <div className="small muted">… et {d.total - d.occupants.length} autres</div>}
      </div>
    </div>
  );
}

const ACT_COLORS: Record<string, string> = { sleep: '#33415a', walk: '#8a7a50', eat: '#c98a3a', work: '#4f8a5a', leisure: '#6a5a8a' };

// Vue Personne : l'habitant suivi dans le silo, sa journée, son activité.
export function FollowCard() {
  const followed = useGame((g) => g.followed);
  const s = useGame((g) => g.snapshot);
  const setFollowed = useGame((g) => g.setFollowed);
  const selectCitizen = useGame((g) => g.selectCitizen);
  const [c, setC] = useState<CitizenDetail | null>(null);
  useEffect(() => {
    if (followed === undefined) return;
    let live = true;
    query<CitizenDetail | null>({ type: 'CITIZEN', id: followed }).then((r) => {
      if (!live || !r) return;
      setC(r);
      useGame.setState({
        followTarget: r.location ? { id: r.id, name: r.name, sector: r.sector, look: r.look, floorIndex: r.location.floorIndex, act: r.location.act } : undefined,
      });
    });
    return () => {
      live = false;
    };
  }, [followed, s?.hour]);
  if (followed === undefined || !c) return null;
  const hour = s?.hour ?? 0;
  return (
    <div className="follow-card panel">
      <header>
        <div className="row gap">
          <Portrait portrait={c.portrait} sector={c.sector} look={c.look} size={40} />
          <div>
            <h3 style={{ margin: 0 }}>{c.name}</h3>
            <div className="small muted">
              {c.officeTitle ?? c.sectorName} · {c.age} ans
            </div>
          </div>
        </div>
        <button className="icon-btn" onClick={() => setFollowed(undefined)} aria-label="Arrêter de suivre">
          <Icon name="x" />
        </button>
      </header>
      <div className="small">
        <span className="accent">Maintenant :</span> {c.routine}
        {c.location && <span className="muted"> · étage {c.location.floorLabel}</span>}
      </div>
      <div className="day-strip" title="Sa journée heure par heure">
        {c.schedule.map((sl) => (
          <span key={sl.hour} className={sl.hour === hour ? 'now' : ''} style={{ background: ACT_COLORS[sl.act] }} title={`${String(sl.hour).padStart(2, '0')}h · ${sl.label} · ${sl.floorLabel}`} />
        ))}
      </div>
      <div className="row between tiny muted">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
      <div className="row gap wrap tiny muted" style={{ marginTop: 4 }}>
        {Object.entries({ sleep: 'sommeil', walk: 'trajet', eat: 'repas', work: 'travail/école', leisure: 'loisirs' }).map(([k, v]) => (
          <span key={k}>
            <span className="dot" style={{ background: ACT_COLORS[k] }} /> {v}
          </span>
        ))}
      </div>
      <div className="row gap" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={() => selectCitizen(c.id)}>
          Fiche complète
        </button>
      </div>
    </div>
  );
}

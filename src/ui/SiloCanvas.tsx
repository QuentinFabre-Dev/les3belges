import { useEffect, useRef, useState } from 'react';
import { query, useGame } from '../game/store';
import { sound } from '../audio/sound';
import { SiloView } from '../render/SiloView';
import type { CitizenSummary } from '../sim/types';
import { Icon } from './common';

export function SiloCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<SiloView | null>(null);
  const [fps, setFps] = useState(60);
  const [npcs, setNpcs] = useState(0);
  const followed = useGame((g) => g.followed);

  useEffect(() => {
    let disposed = false;
    let view: SiloView | null = null;
    SiloView.create(host.current!, useGame.getState().settings).then((v) => {
      if (disposed) {
        v.destroy();
        return;
      }
      view = v;
      viewRef.current = v;
      const s = useGame.getState().snapshot;
      if (s) v.setSnapshot(s);
      v.onSelectFloor = (id) => {
        useGame.getState().selectRoom(undefined);
        useGame.getState().selectFloor(id);
      };
      v.onSelectRoom = (id, side) => useGame.getState().selectRoom(id, side);
      viewRef.current.setFollow(useGame.getState().followTarget ?? null);
      v.onSelectNpc = async (floor, sector) => {
        // Un PNJ visible représente un habitant réel de l'étage : on ouvre une fiche correspondante.
        const res = await query<{ items: CitizenSummary[] }>({ type: 'CITIZENS', floor, sector: sector === 'residential' ? undefined : sector, offset: 0, limit: 40 });
        const pick = res.items[Math.floor(Math.random() * res.items.length)];
        if (pick) useGame.getState().selectCitizen(pick.id);
      };
    });
    const unsub = useGame.subscribe((st, prev) => {
      const v = viewRef.current;
      if (!v) return;
      if (st.snapshot && st.snapshot !== prev.snapshot) v.setSnapshot(st.snapshot);
      if (st.selectedFloor !== prev.selectedFloor) v.setSelected(st.selectedFloor);
      if (st.focusRequest && st.focusRequest !== prev.focusRequest) v.focusFloor(st.focusRequest.floor);
      if (st.settings !== prev.settings) v.setSettings(st.settings);
      if (st.selectedRoom && st.selectedRoom !== prev.selectedRoom && st.selectedRoom.focus) v.focusRoom(st.selectedRoom.floor, st.selectedRoom.side);
      if (st.followTarget !== prev.followTarget) v.setFollow(st.followTarget ?? null);
    });
    const t = setInterval(() => {
      if (viewRef.current) {
        setFps(Math.round(viewRef.current.fps));
        setNpcs(viewRef.current.activeNpcs);
        sound.setFocus(viewRef.current.visibleFloorIds);
      }
    }, 2000);
    return () => {
      disposed = true;
      unsub();
      clearInterval(t);
      view?.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <div className="silo-canvas">
      <div ref={host} className="silo-host" />
      <div className="canvas-tools">
        <button className="icon-btn" onClick={() => viewRef.current?.zoomBy(1.25)} title="Zoom avant" aria-label="Zoom avant">
          <Icon name="zoomIn" />
        </button>
        <button className="icon-btn" onClick={() => viewRef.current?.zoomBy(0.8)} title="Zoom arrière" aria-label="Zoom arrière">
          <Icon name="zoomOut" />
        </button>
        {followed !== undefined && (
          <button className="icon-btn" onClick={() => viewRef.current?.recenterFollow()} title="Recentrer sur l’habitant suivi" aria-label="Recentrer">
            <Icon name="users" />
          </button>
        )}
        <button className="icon-btn" onClick={() => viewRef.current?.fit()} title="Ajuster" aria-label="Ajuster">
          <Icon name="target" />
        </button>
      </div>
      <div className="canvas-hint muted">
        Molette : défiler · Ctrl+molette : zoom · Glisser : déplacer · Clic : étage / habitant (zoomé : salle) · {fps} FPS · {npcs} PNJ
      </div>
    </div>
  );
}

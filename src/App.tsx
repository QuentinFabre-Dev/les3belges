import { useEffect, useState } from 'react';
import { send, setFlag, useGame } from './game/store';
import { Intro } from './ui/Intro';
import { sound } from './audio/sound';
import { EndScreen, YearReportModal } from './ui/Chronicle';
import { Tutorial } from './ui/Tutorial';
import { Investiture } from './ui/Investiture';
import { DebugPanel } from './ui/DebugPanel';
import { severityColor } from './ui/common';
import { FloorCard } from './ui/FloorCard';
import { FollowCard, RoomCard } from './ui/RoomCard';
import { RightPanel } from './ui/RightPanel';
import { Sidebar } from './ui/Sidebar';
import { SiloCanvas } from './ui/SiloCanvas';
import { TopBar } from './ui/TopBar';
import { InstitutionsPanel, PoliciesPanel } from './ui/panels/Governance';
import { CouncilPanel, JusticePanel, OpinionPanel } from './ui/panels/Society';
import { DecisionsPanel, FloorsPanel, IncidentsPanel, InfrastructurePanel, JournalPanel, MessagesPanel, ResourcesPanel, SettingsPanel } from './ui/panels/Panels';
import { PopulationPanel } from './ui/panels/Population';
import type { Speed } from './sim/types';

const PANELS = {
  floors: FloorsPanel,
  population: PopulationPanel,
  resources: ResourcesPanel,
  infrastructure: InfrastructurePanel,
  incidents: IncidentsPanel,
  decisions: DecisionsPanel,
  institutions: InstitutionsPanel,
  council: CouncilPanel,
  justice: JusticePanel,
  opinion: OpinionPanel,
  policies: PoliciesPanel,
  messages: MessagesPanel,
  journal: JournalPanel,
  settings: SettingsPanel,
};

export default function App() {
  const view = useGame((g) => g.view);
  const ready = useGame((g) => !!g.snapshot);
  const toasts = useGame((g) => g.toasts);
  const Active = view !== 'global' ? PANELS[view] : null;
  const phase = useGame((g) => g.phase);
  const selectedRoom = useGame((g) => g.selectedRoom);
  const setPhase = useGame((g) => g.setPhase);
  const [adminName, setAdminName] = useState(() => {
    try {
      return localStorage.getItem('silo-01:admin-name') || 'DSI';
    } catch {
      return 'DSI';
    }
  });
  // Une nouvelle partie vient d'être demandée : l'investiture attend le nouveau monde.
  const [awaitingNew, setAwaitingNew] = useState(false);
  const debug = new URLSearchParams(location.search).has('debug');
  // Mode debug : accès au store depuis la console (et pour les captures automatisées).
  if (debug) Object.assign(window, { silo: useGame, siloSound: sound, siloSend: send });

  // Joueur déjà initié : le temps démarre directement.
  useEffect(() => {
    if (phase === 'play') send({ type: 'SET_SPEED', speed: 1 });
  }, []);

  // Son : déverrouillé au premier geste, piloté par l'état du silo.
  useEffect(() => {
    const st = useGame.getState().settings;
    sound.setVolume(st.volume, st.muted);
    const unlock = () => sound.unlock();
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) sound.click();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('click', onClick, true);
    const unsub = useGame.subscribe((g, prev) => {
      if (g.snapshot && g.snapshot !== prev.snapshot) sound.update(g.snapshot);
      if (g.settings !== prev.settings) sound.setVolume(g.settings.volume, g.settings.muted);
    });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', onClick, true);
      unsub();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ph = useGame.getState().phase;
      if (ph === 'intro' || ph === 'investiture') return;
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      const speeds: Record<string, Speed> = { ' ': 0, '1': 1, '2': 5, '3': 30, '4': 120 };
      if (e.key in speeds) {
        e.preventDefault();
        const cur = useGame.getState().snapshot?.speed ?? 1;
        send({ type: 'SET_SPEED', speed: e.key === ' ' ? (cur === 0 ? 1 : 0) : speeds[e.key] });
      }
      if (e.key === 'Escape') {
        useGame.getState().setView('global');
        useGame.getState().selectFloor(undefined);
        useGame.getState().selectRoom(undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <TopBar />
      <Sidebar />
      <main className="stage">
        <SiloCanvas />
        {Active && <Active />}
        {view === 'global' && (selectedRoom ? <RoomCard /> : <FloorCard />)}
        {view === 'global' && <FollowCard />}
        {!ready && <div className="loading">Initialisation du silo…</div>}
      </main>
      <RightPanel />
      {phase === 'intro' && (
        <Intro
          onDone={(n, difficulty) => {
            setAdminName(n);
            if (difficulty) {
              send({ type: 'SET_SPEED', speed: 0 });
              send({ type: 'NEW_GAME', difficulty });
            }
            setAwaitingNew(!!difficulty);
            setFlag('silo-01:intro-done', true);
            // Le nouveau DSI forme d'abord la direction du silo (si la partie n'a pas commencé).
            setPhase('investiture');
          }}
        />
      )}
      {phase === 'investiture' && ready && (
        <Investiture
          name={adminName}
          awaitingNew={awaitingNew}
          onDone={() => {
            setAwaitingNew(false);
            const tutorialDone = localStorageFlag('silo-01:tutorial-done');
            setPhase(tutorialDone ? 'play' : 'tutorial');
            if (tutorialDone) send({ type: 'SET_SPEED', speed: 1 });
          }}
        />
      )}
      {phase === 'tutorial' && ready && (
        <Tutorial
          name={adminName}
          onDone={() => {
            setFlag('silo-01:tutorial-done', true);
            setPhase('play');
            if ((useGame.getState().snapshot?.speed ?? 0) === 0) send({ type: 'SET_SPEED', speed: 1 });
          }}
        />
      )}
      {debug && <DebugPanel />}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast" style={{ borderColor: severityColor(t.severity) }}>
            {t.text}
          </div>
        ))}
      </div>
      <YearReportModal />
      <EndScreen />
    </div>
  );
}

function localStorageFlag(k: string) {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
}

import { useEffect, useState } from 'react';
import { send, setFlag, useGame } from './game/store';
import { Intro } from './ui/Intro';
import { Tutorial } from './ui/Tutorial';
import { DebugPanel } from './ui/DebugPanel';
import { severityColor } from './ui/common';
import { FloorCard } from './ui/FloorCard';
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
  const gameOver = useGame((g) => g.snapshot?.gameOver);
  const Active = view !== 'global' ? PANELS[view] : null;
  const phase = useGame((g) => g.phase);
  const setPhase = useGame((g) => g.setPhase);
  const [adminName, setAdminName] = useState(() => {
    try {
      return localStorage.getItem('silo-01:admin-name') || 'Administrateur';
    } catch {
      return 'Administrateur';
    }
  });
  const debug = new URLSearchParams(location.search).has('debug');

  // Joueur déjà initié : le temps démarre directement.
  useEffect(() => {
    if (phase === 'play') send({ type: 'SET_SPEED', speed: 1 });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().phase === 'intro') return;
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      const speeds: Record<string, Speed> = { ' ': 0, '1': 1, '2': 2, '3': 5, '4': 10 };
      if (e.key in speeds) {
        e.preventDefault();
        const cur = useGame.getState().snapshot?.speed ?? 1;
        send({ type: 'SET_SPEED', speed: e.key === ' ' ? (cur === 0 ? 1 : 0) : speeds[e.key] });
      }
      if (e.key === 'Escape') {
        useGame.getState().setView('global');
        useGame.getState().selectFloor(undefined);
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
        {view === 'global' && <FloorCard />}
        {!ready && <div className="loading">Initialisation du silo…</div>}
      </main>
      <RightPanel />
      {phase === 'intro' && (
        <Intro
          onDone={(n) => {
            setAdminName(n);
            setFlag('silo-01:intro-done', true);
            setPhase(localStorageFlag('silo-01:tutorial-done') ? 'play' : 'tutorial');
            if (localStorageFlag('silo-01:tutorial-done')) send({ type: 'SET_SPEED', speed: 1 });
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
      {gameOver && (
        <div className="modal-back">
          <div className="modal gameover">
            <h2>Le silo est perdu</h2>
            <p>
              Jour {gameOver.day} — {gameOver.reason}
            </p>
            <h4>Derniers événements marquants</h4>
            {gameOver.chain.map((c, i) => (
              <div key={i} className="small cause">
                ↳ {c}
              </div>
            ))}
            <div className="row gap">
              <button className="btn" onClick={() => send({ type: 'NEW_GAME' })}>
                Nouvelle partie
              </button>
              <button className="btn" onClick={() => send({ type: 'LOAD' })}>
                Charger la dernière sauvegarde
              </button>
            </div>
          </div>
        </div>
      )}
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

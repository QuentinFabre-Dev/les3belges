import { useGame, type View } from '../game/store';
import { Icon } from './common';

export function Sidebar() {
  const view = useGame((g) => g.view);
  const setView = useGame((g) => g.setView);
  const s = useGame((g) => g.snapshot);
  const incidents = s?.incidents.filter((i) => i.status !== 'resolved').length ?? 0;
  const decisions = s?.decisions.length ?? 0;
  const unread = s?.messages.filter((m) => !m.read).length ?? 0;
  const items: [View, string, string, number?][] = [
    ['global', 'Vue globale', 'home'],
    ['floors', 'Étage par étage', 'layers'],
    ['population', 'Population', 'users'],
    ['resources', 'Ressources', 'box'],
    ['infrastructure', 'Infrastructure', 'wrench'],
    ['incidents', 'Incidents', 'alert', incidents],
    ['decisions', 'Décisions', 'check', decisions],
    ['institutions', 'Institutions', 'landmark', s?.election && !s.election.winnerId ? 1 : 0],
    ['council', 'Conseil', 'table', s?.council && !s.council.resolved ? 1 : 0],
    ['justice', 'Justice', 'scale', s?.cases.filter((k) => k.status === 'trial').length ?? 0],
    ['opinion', 'Opinion', 'chat', (s?.factions.filter((f) => f.stage >= 2).length ?? 0) + (s?.signals.length ?? 0)],
    ['policies', 'Politiques', 'sliders'],
    ['messages', 'Messages', 'mail', unread],
    ['journal', 'Journal', 'book'],
  ];
  return (
    <nav className="sidebar">
      {items.map(([id, label, icon, badge]) => (
        <button key={id} data-tut={`nav-${id}`} className={`nav ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>
          <Icon name={icon} size={20} />
          <span>{label}</span>
          {!!badge && <span className="badge">{badge}</span>}
        </button>
      ))}
      <div className="sidebar-foot muted">
        {s && (
          <>
            <div>Fiabilité des données : {Math.round(s.infoAccuracy * 100)} %</div>
            <div>Légitimité {s.psychology.legitimacy} · Autorité {s.psychology.authority}</div>
          </>
        )}
      </div>
    </nav>
  );
}
